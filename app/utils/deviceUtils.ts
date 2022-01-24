import { Dimensions, Platform } from "react-native";

const { height, width } = Dimensions.get("window");

const deviceUtils: {
  iPhoneXHeight: number;
  iPhoneXWidth: number;
  iPhone6Height: numnber;
  iphoneSEHeight: number;
  isNarrowPhone: boolean;
  isSmallPhone: boolean;
  isLargePhone: boolean;
  isTallPhone: boolean;
  isTinyPhone: boolean;
  isIOS14: boolean;
  dimensions: {
    height: number;
    width: number;
  };
} = {};

deviceUtils.iPhoneXHeight = 812;
deviceUtils.iPhoneXWidth = 375;
deviceUtils.iPhone6Height = 667;
deviceUtils.iphoneSEHeight = 568;

deviceUtils.isNarrowPhone = width < deviceUtils.iPhoneXWidth;
deviceUtils.isSmallPhone = height <= deviceUtils.iPhone6Height;
deviceUtils.isLargePhone = width >= deviceUtils.iPhoneXWidth;

deviceUtils.isTallPhone = height >= deviceUtils.iPhoneXHeight;
deviceUtils.isTinyPhone = height <= deviceUtils.iphoneSEHeight;
deviceUtils.isIOS14 = Platform.OS === "ios" && parseFloat(Platform.Version) >= 14;

deviceUtils.dimensions = {
  height,
  width,
};

export default deviceUtils;
