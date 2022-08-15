import { NavigationProp, RouteProp } from "@react-navigation/native"
import { BottomSheet, Button, Card, Icon, Input } from "@rneui/themed"
import React, { useEffect, useState, useRef, useCallback } from "react"
import {
  ActivityIndicator,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Share,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native"
import { StyleSheet, FlatList, BackHandler, InteractionManager } from "react-native"
import { NativeViewGestureHandler } from "react-native-gesture-handler"
import { useRecoilState } from "recoil"
import { Header, Text } from "../../components"
import { HeaderArrowBack, HeaderLeftContainer, HeaderRightContainer } from "../../components/header"
import { RootStackParamList } from "../../navigators"
import { Assets } from "../../services/localdb"
import { singleAssetState, mediasState, recyclerSectionsState } from "../../store"
import { Asset, SyncStatus } from "../../types"
import { GalleryImage } from "./gallery-image"
import Toast from "react-native-toast-message"
import { useNetInfo } from "@react-native-community/netinfo"
import {
  AddBoxs,
  downloadAndDecryptAsset,
  downloadAsset,
  uploadAssetsInBackground,
} from "../../services/sync-service"
import * as helper from "../../utils/helper"
import { TaggedEncryption } from "@functionland/fula-sec"
import { AddShareMeta, getAssetMeta } from "../../services/remote-db-service"
import { BSON } from "realm"
import { palette } from "../../theme"
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated"

interface ImageGalleryViewerScreenProps {
  navigation: NavigationProp<RootStackParamList>
  route: RouteProp<RootStackParamList, "ImageGalleryViewer">
}

export const ImageGalleryViewerScreen: React.FC<ImageGalleryViewerScreenProps> = ({
  route,
  navigation,
}) => {
  const [asset, setAsset] = useRecoilState(singleAssetState)
  const [recyclerList, setRecyclerSections] = useRecoilState(recyclerSectionsState)
  const [medias, setMedias] = useRecoilState(mediasState)
  const { assetId, scrollToItem } = route.params
  const windowDims = useWindowDimensions()
  const initialIndexRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [showShareBottomSheet, setShowShareBottomSheet] = useState(false)
  const [DID, setDID] = useState("")
  const [sharing, setSharing] = useState(false)
  const netInfoState = useNetInfo()
  const screenOpacity = useSharedValue(1)
  const currentAssetRef = useRef(asset)
  const scrollRef = useRef(null)

  if (initialIndexRef.current === null) {
    for(let i = 0;i<medias.length;i++){
      const currentAsset = medias[i]
      if (currentAsset.id === assetId) {
        initialIndexRef.current = i
        break;
      }
    }
  }

  const listGestureRef = useRef()

  useEffect(() => {
    const onBack = () => {
      goBack()
      return true
    }
    BackHandler.addEventListener("hardwareBackPress", onBack)
    return () => {
      BackHandler.removeEventListener("hardwareBackPress", onBack)
    }
  }, [])

  const enableScroll = useCallback(() => {
    scrollRef.current.setNativeProps({ scrollEnabled: true })
  }, [])

  const disableScroll = useCallback(() => {
    scrollRef.current.setNativeProps({ scrollEnabled: false })
  }, [])

  const renderItem = useCallback(
    ({ item }) => {
      return (
        <GalleryImage
          asset={item}
          enableParentScroll={enableScroll}
          disableParentScroll={disableScroll}
          listGestureRef={listGestureRef}
          screenOpacity={screenOpacity}
        />
      )
    },
    [enableScroll, disableScroll, screenOpacity],
  )

  const goBack = useCallback(() => {
    navigation.setParams({ assetId: currentAssetRef.current.id })
    setTimeout(() => {
      navigation.goBack()
    })
  }, [])

  const cancelUpdate = useCallback(() => {
    Alert.alert("Waiting for connection", "Will upload when connected", [
      {
        text: "Cancel update",
        onPress: async () => {
          console.log("onPressed ", asset)
          await Assets.addOrUpdate([
            {
              id: asset.id,
              syncStatus: SyncStatus.NOTSYNCED,
            },
          ])
          setAsset((prev) => ({
            ...prev,
            syncStatus: SyncStatus.NOTSYNCED,
          }))
        },
      },
      {
        text: "OK",
      },
    ])
  }, [asset])

  const uploadToBox = useCallback(async () => {
    if (asset?.syncStatus === SyncStatus.NOTSYNCED && !asset?.isDeleted) {
      setLoading(true)
      setTimeout(async () => {
        try {
          // const _filePath = asset.uri?.split('file:')[1];
          // const result = await file.send(decodeURI(_filePath))
          // console.log("result:",result)
          await Assets.addOrUpdate([
            {
              id: asset.id,
              syncStatus: SyncStatus.SYNC,
            },
          ])
          setAsset((prev) => ({
            ...prev,
            syncStatus: SyncStatus.SYNC,
          }))
          if (!netInfoState.isConnected) {
            Toast.show({
              type: "info",
              text1: "Will upload when connected",
              position: "bottom",
              bottomOffset: 0,
            })
            return
          }
          try {
            await AddBoxs()
          } catch (error) {
            Alert.alert("Warning", error)
            return
          }
          try {
            Toast.show({
              type: "info",
              text1: "Upload...",
              position: "bottom",
              bottomOffset: 0,
            })
            await uploadAssetsInBackground({
              callback: (success) => {
                if (success)
                  setAsset((prev) => ({
                    ...prev,
                    syncStatus: SyncStatus.SYNC,
                  }))
                else
                  Toast.show({
                    type: "error",
                    text1: "Will upload when connected",
                    position: "bottom",
                    bottomOffset: 0,
                  })
              },
            })
          } catch (error) {
            Alert.alert("Error", "Unable to send the file now, will upload when connected")
          }
        } catch (error) {
          console.log("uploadOrDownload", error)
          Alert.alert("Error", "Unable to send the file, make sure your box is available!")
        } finally {
          setLoading(false)
        }
      }, 0)
    } else if (asset?.syncStatus === SyncStatus.SYNC) {
      cancelUpdate()
    }
  }, [asset, netInfoState.isConnected, cancelUpdate])

  const renderHeader = useCallback(() => {
    return (
      <Header
        containerStyle={{ marginTop: 0, zIndex: 10, elevation: 3 }}
        leftComponent={
          <HeaderLeftContainer>
            <HeaderArrowBack navigation={navigation} iconProps={{ onPress: goBack }} />
          </HeaderLeftContainer>
        }
        rightComponent={
          <HeaderRightContainer>
            {loading ? (
              <ActivityIndicator size="small" />
            ) : asset?.syncStatus === SyncStatus.SYNCED && !asset?.isDeleted ? (
              <Icon type="material-community" name="cloud-check" />
            ) : asset?.syncStatus === SyncStatus.NOTSYNCED && !asset?.isDeleted ? (
              <Icon type="material-community" name="cloud-upload-outline" onPress={uploadToBox} />
            ) : asset?.syncStatus === SyncStatus.SYNC ? (
              <Icon type="material-community" name="refresh" onPress={uploadToBox} />
            ) : null}
            {asset?.syncStatus === SyncStatus.SYNCED && (
              <Icon
                type="material-community"
                style={styles.headerIcon}
                name="share-variant"
                onPress={() => {
                  setDID("")
                  setShowShareBottomSheet(true)
                }}
              />
            )}
          </HeaderRightContainer>
        }
      />
    )
  }, [navigation, loading, uploadToBox, asset, goBack])

  const shareWithDID = useCallback(async () => {
    if (!DID) return
    setSharing(true)
    try {
      const shareAsset = (await Assets.getById(asset.id))?.[0]
      const myDID = await helper.getMyDID()
      if (myDID && shareAsset) {
        const myTag = new TaggedEncryption(myDID.did)
        const symetricKey = (await helper.decryptJWE(myDID.did, JSON.parse(shareAsset?.jwe)))
          ?.symetricKey
        const jwe = await myTag.encrypt(symetricKey, symetricKey?.id, [DID])
        await AddShareMeta({
          id: new BSON.UUID().toHexString(),
          ownerId: myDID.authDID,
          fileName: asset.filename,
          cid: asset.cid,
          jwe: jwe,
          shareWithId: DID,
          date: new Date().getTime(),
        })
        Alert.alert(
          "Shared",
          "This asset is added to the shared collection on the Box, do you want to create a sharing link too?",
          [
            {
              text: "No",
              style: "cancel",
            },
            {
              text: "Yes",
              onPress: () => {
                Share.share({
                  title: "Fotos | Just shared an asset",
                  message: `https://fotos.fx.land/shared/${Buffer.from(
                    JSON.stringify(jwe),
                    "utf-8",
                  ).toString("base64")}`,
                })
              },
            },
          ],
        )
      }
    } catch (error) {
      Alert.alert("Error", error.toString())
      console.log(error)
    } finally {
      setSharing(false)
      setShowShareBottomSheet(false)
    }
  }, [DID, asset])

  const downloadFromBox = useCallback(async () => {
    if (asset?.syncStatus === SyncStatus.SYNCED && asset?.isDeleted) {
      setLoading(true)
      setTimeout(async () => {
        try {
          try {
            await AddBoxs()
          } catch (error) {
            Alert.alert("Warning", error)
            return
          }
          const myDID = await helper.getMyDID()
          let fileRef = null
          if (myDID) {
            const meta = await getAssetMeta(myDID.authDID, asset.cid)
            fileRef = (await helper.decryptJWE(myDID.did, meta?.jwe))?.symetricKey
          }
          let result = null
          if (fileRef) {
            result = await downloadAndDecryptAsset(fileRef)
          } else {
            result = await downloadAsset(asset?.cid)
          }
          if (result) {
            setAsset((prev) => ({
              ...prev,
              uri: result.uri,
              isDeleted: false,
            }))
            Assets.addOrUpdate([
              {
                id: asset.id,
                uri: result.uri,
                isDeleted: false,
              },
            ])
          }
        } catch (error) {
          console.log("uploadOrDownload", error)
          Alert.alert("Error", "Unable to receive the file, make sure your box is available!")
        } finally {
          setLoading(false)
        }
      }, 0)
    }
  }, [asset])

  const renderDownloadSection = useCallback(() => {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Card containerStyle={{ borderWidth: 0 }}>
          <Icon
            type="material-community"
            name="cloud-download-outline"
            size={78}
            onPress={downloadFromBox}
          />
          <Card.Title>Tap to download</Card.Title>
        </Card>
      </View>
    )
  }, [downloadFromBox])

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { x: xOffset } = event.nativeEvent.contentOffset
      const imageWidth = windowDims.width
      const index = Math.round(xOffset / imageWidth)
      const currentAsset = medias[index]
      currentAssetRef.current = currentAsset
      setAsset(currentAsset)
      InteractionManager.runAfterInteractions(() => {
        for (let i = 0; i < recyclerList.length; i++) {
          const section = recyclerList[i]
          if (section.id === currentAsset.id) {
            scrollToItem(section, false)
            break;
          }
        }
      })
    },
    [windowDims.width],
  )

  const onActionPress = useCallback((action: string) => {
    alert(`Action ${action} is being developed`)
  }, [])

  const renderActionButtons = useCallback(() => {
    return (
      <View style={styles.actionButtonContainer}>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("delete")}>
          <Icon name="delete" type="material-community" size={30} color={palette.white} />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("print")}>
          <Icon name="printer" type="material-community" size={30} color={palette.white} />
          <Text style={styles.actionText}>Print</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("upload")}>
          <Icon
            name="cloud-upload-outline"
            type="material-community"
            size={30}
            color={palette.white}
          />
          <Text style={styles.actionText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("AddToAlbum")}>
          <Icon name="playlist-plus" type="material-community" size={30} color={palette.white} />
          <Text style={styles.actionText}>Add to Album</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("openWith")}>
          <Icon name="open-in-app" type="material-community" size={30} color={palette.white} />
          <Text style={styles.actionText}>Open With</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconContainer} onPress={() => onActionPress("help")}>
          <Icon
            name="help-circle-outline"
            type="material-community"
            size={30}
            color={palette.white}
          />
          <Text style={styles.actionText}>Help</Text>
        </TouchableOpacity>
      </View>
    )
  }, [])

  const wrapperAnimatedStyle = useAnimatedStyle(() => {
    return {
      flex: 1,
      justifyContent: "center",
      backgroundColor: "black",
      opacity: screenOpacity.value,
    }
  })

  const getItemLayout = useCallback((data, index) => {
    return { length: windowDims.width, offset: windowDims.width * index, index: index }
  }, [])

  const keyExtractor = useCallback((item: Asset) => item.id , [])

  return (
    <Animated.View style={wrapperAnimatedStyle}>
      <View style={styles.list}>
        {renderHeader()}
        <NativeViewGestureHandler ref={listGestureRef}>
          <FlatList
            ref={scrollRef}
            horizontal={true}
            initialScrollIndex={initialIndexRef.current}
            style={styles.list}
            getItemLayout={getItemLayout}
            renderItem={renderItem}
            removeClippedSubviews={true}
            keyExtractor={keyExtractor}
            onMomentumScrollEnd={onMomentumScrollEnd}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            maxToRenderPerBatch={3}
            windowSize={3}
            initialNumToRender={3}
            pagingEnabled={true}
            data={medias}
          />
        </NativeViewGestureHandler>
        {renderActionButtons()}
        <BottomSheet
          isVisible={showShareBottomSheet}
          onBackdropPress={() => setShowShareBottomSheet(false)}
          modalProps={{ transparent: true, animationType: "fade" }}
          containerStyle={styles.bottomSheetContainer}
        >
          <Card containerStyle={{ borderWidth: 0, margin: 0 }}>
            <Card.Title>Share with (enter DID)</Card.Title>
            <Input onChangeText={(txt) => setDID(txt)} onEndEditing={shareWithDID} />
          </Card>
          <Button
            title={
              sharing ? (
                <ActivityIndicator style={styles.activityIndicatorStyle} size="small" />
              ) : (
                "Share"
              )
            }
            onPress={shareWithDID}
          ></Button>
        </BottomSheet>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
  },
  headerIcon: {
    marginHorizontal: 10,
  },
  list: { flex: 1 },
  bottomSheetContainer: {
    backgroundColor: "rgba(189,189,189,.2)",
  },
  activityIndicatorStyle: {
    padding: 5,
  },
  actionText: { textAlign: "center", color: palette.white },
  iconContainer: { flex: 1, flexDirection: "column" },
  actionButtonContainer: {
    position: "absolute",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
  },
})
