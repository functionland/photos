import React, {useEffect, useState, useRef} from 'react';
import {BaseItemAnimator, BaseScrollView, DataProvider, LayoutProvider, RecyclerListView} from 'recyclerlistview';
import {
	Animated,
	Text,
	StyleSheet,
	StatusBar,
	View,
	FlatList,
	SafeAreaView,
} from 'react-native';
import {layout, story,} from '../types/interfaces';
import PhotosChunk from './PhotosChunk';
import ThumbScroll from './ThumbScroll';
import Highlights from './Highlights';
import {LayoutUtil} from '../utils/LayoutUtil';
import FloatingFilters from './FloatingFilters';
import {useBackHandler} from '@react-native-community/hooks'
import {
	default as Reanimated,
	useSharedValue,
	useAnimatedRef,
	useDerivedValue,
	scrollTo as reanimatedScrollTo,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	interpolate,
	runOnJS,
	withDelay,
	withTiming,
} from 'react-native-reanimated';
import {timestampToDate} from '../utils/functions';
import {useRecoilState} from 'recoil';
import {headerIndexesState, layoutState, storiesState} from '../states/gallery';

class ItemAnimator extends React.Component implements BaseItemAnimator {
	constructor(props: any) {
		super(props);
	}

	animateWillMount(atX: number, atY: number, itemIndex: number) {
		console.log(['animateWillMount', atX, atY, itemIndex]);
		//This method is called before the componentWillMount of the list item in the rowrenderer
		//Fill in your logic.
		return undefined;
	}

	animateDidMount(atX: number, atY: number, itemRef: any, itemIndex: number) {
		console.log(['animateDidMount', atX, atY, itemIndex]);
		//This method is called after the componentDidMount of the list item in the rowrenderer
		//Fill in your logic
		//No return
	}

	animateWillUpdate(fromX: number, fromY: number, toX: number, toY: number, itemRef: any, itemIndex: number): void {
		console.log(['animateWillUpdate', fromX, fromY, toX, toY, itemIndex]);
		//This method is called before the componentWillUpdate of the list item in the rowrenderer. If the list item is not re-rendered,
		//It is not triggered. Fill in your logic.
		// A simple example can be using a native layout animation shown below - Custom animations can be implemented as required.
		//LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		//No return
	}

	animateShift(fromX: number, fromY: number, toX: number, toY: number, itemRef: any, itemIndex: number): boolean {
		console.log(['animateShift', fromX, fromY, toX, toY, itemIndex]);
		//This method is called if the the props have not changed, but the view has shifted by a certain amount along either x or y axes.
		//Note that, this method is not triggered if the props or size has changed and the animateWillUpdate will be triggered in that case.
		//Return value is used as the return value of shouldComponentUpdate, therefore will trigger a view re-render if true.
		return false;
	}

	animateWillUnmount(atX: number, atY: number, itemRef: any, itemIndex: number): void {
		console.log('animateWillUnmount index ' + itemIndex)
		//This method is called before the componentWillUnmount of the list item in the rowrenderer
		//No return
	}
}

class ExternalScrollView extends BaseScrollView {
	scrollTo(...args: any[]) {
		(this.props as any).scrollRefExternal?.current?.scrollTo(...args);
	}

	render() {
		return (
			<Reanimated.ScrollView {...this.props}
								   style={{zIndex: 1}}
								   ref={(this.props as any).scrollRefExternal}
								   scrollEventThrottle={16}
								   nestedScrollEnabled={true}
								   removeClippedSubviews={true}
								   showsVerticalScrollIndicator={false}
			>
				{this.props.children}
			</Reanimated.ScrollView>
		);
	}
}

interface Props {
	maxWidth: number;
	minWidth: number;
	numColumns: 2 | 3 | 4;
	loading: boolean;
	sortCondition: 'day' | 'month';
	scale: Reanimated.SharedValue<number>;
	numColumnsAnimated: Reanimated.SharedValue<number>;
	scrollIndex2: Animated.Value;
	scrollIndex3: Animated.Value;
	scrollIndex4: Animated.Value;
	focalY: Animated.Value;
	numberOfPointers: Animated.Value;
	modalShown: Reanimated.SharedValue<number>;
	headerShown: Reanimated.SharedValue<number>;
	storiesHeight: number;
	showStory: Animated.Value;
	scrollY: Reanimated.SharedValue<number>;
	HEADER_HEIGHT: number;
	FOOTER_HEIGHT: number;
	animatedImagePositionX: Reanimated.SharedValue<number>;
	animatedImagePositionY: Reanimated.SharedValue<number>;
	animatedSingleMediaIndex: Reanimated.SharedValue<number>;
	singleImageWidth: Reanimated.SharedValue<number>;
	singleImageHeight: Reanimated.SharedValue<number>;
	selectedAssets: Reanimated.SharedValue<string[]>;
	lastSelectedAssetId: Reanimated.SharedValue<string>;
	lastSelectedAssetAction: Reanimated.SharedValue<number>;
	dragY: Reanimated.SharedValue<number>;
	SCREEN_HEIGHT: number;
	SCREEN_WIDTH: number;
}

const RenderPhotos: React.FC<Props> = (props) => {
	const [stories] = useRecoilState(storiesState);
	const [layouts] = useRecoilState(layoutState);
	const [headerIndexes] = useRecoilState(headerIndexesState)
	const headerHeight = 20;
	const indicatorHeight = 50;

	const [layoutProvider,setLayoutProvider] = useState<LayoutProvider>(LayoutUtil.getLayoutProvider(props.numColumns, props.sortCondition, headerHeight, props.storiesHeight, props.HEADER_HEIGHT));
	const [dataProvider, setDataProvider] = useState<DataProvider>(()=>{return new DataProvider((r1,r2)=>{
		return r1 !== r2
	})})
	layoutProvider.shouldRefreshWithAnchoring = true;
	const scrollRef: any = useRef();
	const scrollRefExternal = useAnimatedRef<Reanimated.ScrollView>();
	const showThumbScroll = useSharedValue(0);
	const showFloatingFilters = useSharedValue(0);

	const animatedTimeStampString = useSharedValue('');

	const layoutHeightAnimated = useSharedValue(99999999);

	const animatedStyle = useAnimatedStyle(() => {
		const scale = (props.numColumns === props.numColumnsAnimated.value) ? interpolate(
			props.scale.value,
			[0, 1, 4],
			[props.numColumns / (props.numColumns + 1), 1, (props.numColumns) / (props.numColumns - 1)]
		) : ((props.numColumns === props.numColumnsAnimated.value + 1) ? interpolate(
			props.scale.value,
			[0, 1, 4],
			[1, (props.numColumns) / (props.numColumns - 1), (props.numColumns) / (props.numColumns - 1)]
		) : ((props.numColumns === props.numColumnsAnimated.value - 1) ? interpolate(
			props.scale.value,
			[0, 1, 4],
			[(props.numColumns) / (props.numColumns + 1), (props.numColumns) / (props.numColumns + 1), 1]
		) : 1));

		return {
			opacity: (props.numColumnsAnimated.value === props.numColumns) ? (interpolate(
				props.scale.value,
				[0, 1, 4],
				[0, 1, 0]
			)) : (props.numColumnsAnimated.value === (props.numColumns - 1) ? (interpolate(
				props.scale.value,
				[0, 1, 4],
				[1, 0, 0]
			)) : (props.numColumnsAnimated.value === (props.numColumns + 1) ? (interpolate(
				props.scale.value,
				[0, 1, 4],
				[0, 0, 1]
			)) : (0))),
			zIndex: (props.numColumnsAnimated.value === props.numColumns) ? 1 : 0,
			transform: [
				{
					scale: scale,
				},
				{
					translateX: (
						(
							(
								scale * props.SCREEN_WIDTH) -
							props.SCREEN_WIDTH)
						/ (2 * scale))
				},
				{
					translateY: (
						(
							(
								scale * (props.SCREEN_HEIGHT - (StatusBar.currentHeight || 0))
							) - (props.SCREEN_HEIGHT - (StatusBar.currentHeight || 0))
						)
						/ (2 * scale))
				}
			],
		};
	});

	useEffect(() => {
		console.log([Date.now() + ': component RenderPhotos' + props.numColumns + ' rendered']);
	});

	/****
	 * The below lines are to update the selection checkbox status in each media
	 */
	const clearSelection = useRef(new Animated.Value(0)).current;
	const selectedAssetsRef = useRef<string[]>([]);
	const setSelectedAssetsRef = (selected: string[]) => {
		selectedAssetsRef.current = selected;
	}
	const setClearSelection = (clear: number) => {
		clearSelection.setValue(clear);
	}
	useDerivedValue(() => {
		//we need to add a dummy condition on the props.lastSelectedAssetAction.value and props.lastSelectedAssetIndex.value so that useDerivedValue does not ignore updating
		if (props.lastSelectedAssetAction.value > -1 && props.lastSelectedAssetId.value !== 'Thisisjustadummytext') {
			runOnJS(setSelectedAssetsRef)(props.selectedAssets.value);
			if (props.selectedAssets.value.length) {
				runOnJS(setClearSelection)(1);
			} else {
				console.log('erasing selection');
				runOnJS(setClearSelection)(0);
			}
			//selectedAssetsRef.current = props.selectedAssets.value;
		}

	}, [props.lastSelectedAssetAction, props.lastSelectedAssetId]);

	/****
	 * The below lines are to update the scroll position across all modes
	 */
	useEffect(() => {
		console.log(['component RenderPhotos mounted ' + props.numColumns]);

		if (props.numColumns === 3 || props.numColumns === 4) {
			//props.scrollIndex2.removeAllListeners();
			props.scrollIndex2.addListener(({value}) => {
				scrollRef?.current?.scrollToIndex(value, false);
			});
		}

		if (props.numColumns === 2 || props.numColumns === 3) {
			//props.scrollIndex4.removeAllListeners();
			props.scrollIndex4.addListener(({value}) => {
				scrollRef?.current?.scrollToIndex(value, false);
			});
		}

		if (props.numColumns === 2 || props.numColumns === 4) {
			//props.scrollIndex3.removeAllListeners();
			props.scrollIndex3.addListener(({value}) => {
				scrollRef?.current?.scrollToIndex(value, false);
			});
		}
		return () => {
			console.log(['component RenderPhotos unmounted']);
			if (props.numColumns === 2 || props.numColumns === 3) {
				props.scrollIndex4.removeAllListeners();
			}
			if (props.numColumns === 3 || props.numColumns === 4) {
				props.scrollIndex2.removeAllListeners();
			}
			if (props.numColumns === 2 || props.numColumns === 4) {
				props.scrollIndex3.removeAllListeners();
			}
		}
	}, []);
	
	// If layout dependencies change rerender
	// useEffect(()=>{
	// 	setLayoutProvider(LayoutUtil.getLayoutProvider(props.numColumns, props.sortCondition, headerHeight, props.storiesHeight, props.HEADER_HEIGHT))
	// },[props.numColumns, props.sortCondition, headerHeight, props.storiesHeight, props.HEADER_HEIGHT])

	useEffect(()=>{
		setDataProvider(dataProvider.cloneWithRows(layouts));
	},[layouts])
	

	useBackHandler(() => {
		return false
	})

	const rowRenderer = React.useCallback((type: string | number, data: layout, index: number) => {
		if (data.sortCondition !== '' && data.sortCondition !== props.sortCondition) {
			return (<></>)
		}
		switch (type) {
			case 'story':
				return (
					<SafeAreaView style={{position: 'relative', zIndex: 1, marginTop: props.HEADER_HEIGHT}}>
						<FlatList
							data={stories}
							horizontal={true}
							keyExtractor={(item: story, index: number) => 'StoryItem_' + index + '_' + item.text}
							getItemLayout={(data, index) => {
								return {
									length: 15 + props.storiesHeight / 1.618,
									offset: index * (15 + props.storiesHeight / 1.618),
									index: index
								}
							}}
							showsHorizontalScrollIndicator={false}
							renderItem={({item}) => (
								<View
									style={{
										width: 15 + props.storiesHeight / 1.618,
										height: props.storiesHeight + 25,
									}}>
									<Highlights
										story={item}
										duration={1500}
										numColumns={props.numColumns}
										height={props.storiesHeight}
										showStory={props.showStory}
										headerShown={props.headerShown}
									/>
								</View>
							)}
						/>
					</SafeAreaView>
				);
			default:
				// props.uploadingPercent.current[index] = new Animated.Value(0);
				return (
					<PhotosChunk
						photo={data}
						index={data.index}
						modalShown={props.modalShown}
						headerShown={props.headerShown}
						headerHeight={headerHeight}
						selectedAssets={props.selectedAssets}
						lastSelectedAssetId={props.lastSelectedAssetId}
						lastSelectedAssetAction={props.lastSelectedAssetAction}
						selectedAssetsRef={selectedAssetsRef}
						clearSelection={clearSelection}
						animatedImagePositionX={props.animatedImagePositionX}
						animatedImagePositionY={props.animatedImagePositionY}
						animatedSingleMediaIndex={props.animatedSingleMediaIndex}
						singleImageWidth={props.singleImageWidth}
						singleImageHeight={props.singleImageHeight}
						imageWidth={(typeof data.value !== 'string') ? data.value.width : 0}
						imageHeight={(typeof data.value !== 'string') ? data.value.height : 0}
						SCREEN_HEIGHT={props.SCREEN_HEIGHT}
						SCREEN_WIDTH={props.SCREEN_WIDTH}
					/>
				);
		}
	}, [layouts?.length]);


	const _onMomentumScrollEnd = () => {
		let currentTimeStamp = 0;
		let lastIndex = (scrollRef?.current?.findApproxFirstVisibleIndex() || 0);
		let currentImage = layouts[lastIndex].value;

		if (typeof currentImage === 'string') {
			currentImage = layouts[lastIndex + 1]?.value;
			if (currentImage && typeof currentImage === 'string') {
				currentImage = layouts[lastIndex + 2]?.value;
			}
		}
		if (currentImage && typeof currentImage !== 'string') {
			currentTimeStamp = currentImage.modificationTime;
		}
		let currentTimeStampString = timestampToDate(currentTimeStamp, ['month']).month;
		animatedTimeStampString.value = currentTimeStampString;

		if (props.numColumns === 2) {
			props.scrollIndex2.setValue(lastIndex);
		} else if (props.numColumns === 3) {
			props.scrollIndex3.setValue(lastIndex);
		} else if (props.numColumns === 4) {
			props.scrollIndex4.setValue(lastIndex);
		}
		showThumbScroll.value = withDelay(3000, withTiming(0));
	}
	useDerivedValue(() => {
		reanimatedScrollTo(scrollRefExternal, 0, props.dragY.value, false);
	}, [props.dragY]);
	
	

	const scrollHandlerReanimated = useAnimatedScrollHandler({
		onScroll: (e) => {
			//position.value = e.contentOffset.x;
			props.scrollY.value = e.contentOffset.y;
			layoutHeightAnimated.value = e.contentSize.height;
			showThumbScroll.value = 1;
		},
		onEndDrag: (e) => {
			console.log('onEndDrag');
		},
		onMomentumEnd: (e) => {
			runOnJS(_onMomentumScrollEnd)();
			//let lastIndex = scrollRef?.current?.findApproxFirstVisibleIndex();
		},
	});

	// const itemAnimator = new ItemAnimator({uploadingPercent: props.uploadingPercent});

	return layouts ? (
		<Reanimated.View
			// eslint-disable-next-line react-native/no-inline-styles
			style={[animatedStyle, {
				flex: 1,
				width: props.SCREEN_WIDTH,
				height: props.SCREEN_HEIGHT,
				position: 'absolute',
				top: 0,
				bottom: 0,
				right: 0,
				left: 0,
			}]}
		>
			<RecyclerListView
				ref={scrollRef}
				externalScrollView={ExternalScrollView}
				style={{
					flex: 1,
					width: props.SCREEN_WIDTH,
					height: props.SCREEN_HEIGHT,
					position: 'absolute',
					top: 0,
					bottom: 0,
					marginTop: 0,
					right: 0,
					left: 0,
					zIndex:1,
				}}
				optimizeForInsertDeleteAnimations={true}
				dataProvider={dataProvider}
				layoutProvider={layoutProvider}
				rowRenderer={rowRenderer}
				scrollViewProps={{
					scrollRefExternal:scrollRefExternal,
					_onScrollExternal:scrollHandlerReanimated,
				}}
			/>

			<ThumbScroll
				indicatorHeight={indicatorHeight}
				flexibleIndicator={false}
				shouldIndicatorHide={true}
				opacity={showThumbScroll}
				showFloatingFilters={showFloatingFilters}
				hideTimeout={500}
				dragY={props.dragY}
				headerHeight={headerHeight}
				FOOTER_HEIGHT={props.FOOTER_HEIGHT}
				HEADER_HEIGHT={props.HEADER_HEIGHT}
				scrollY={props.scrollY}
				scrollIndicatorContainerStyle={{}}
				scrollIndicatorStyle={{}}
				layoutHeight={layoutHeightAnimated}
				currentImageTimestamp={animatedTimeStampString}
			/>
			<FloatingFilters
				headerIndexes={headerIndexes}
				floatingFiltersOpacity={showFloatingFilters}
				numColumns={props.numColumns}
				sortCondition={props.sortCondition}
				headerHeight={headerHeight}
				FOOTER_HEIGHT={props.FOOTER_HEIGHT}
				HEADER_HEIGHT={props.HEADER_HEIGHT}
				indicatorHeight={indicatorHeight}
				layoutHeight={layoutHeightAnimated}
			/>
		</Reanimated.View>
	) : (
		<Animated.View
			// eslint-disable-next-line react-native/no-inline-styles
			style={{
				flex: 1,
				width: props.SCREEN_WIDTH,
				height: props.SCREEN_HEIGHT,
				position: 'absolute',
				top: 0,
				bottom: 0,
				marginTop: StatusBar.currentHeight || 0,
				right: 0,
				left: 0,
			}}>
			<Text>Loading...</Text>
		</Animated.View>
	);
};
const styles = StyleSheet.create({
	header: {
		fontSize: 18,
		backgroundColor: '#fff',
	},
});

const isEqual = (prevProps: Props, nextProps: Props) => {
	return (prevProps === nextProps);
}

export default React.memo(RenderPhotos, isEqual);
