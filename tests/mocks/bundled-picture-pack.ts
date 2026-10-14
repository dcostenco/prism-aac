/** UI unit suites isolate transport; downloader suites and browser checks use the real service. */
export const isBundledPicture = () => false;
export const localPictureUrl = (url: string | null) => url;
export const picturePackVersion = () => 0;
export const subscribePicturePack = () => () => {};
export const watchPicturePack = () => () => {};
export const picturesAvailableOffline = () => false;
export const preparePictureStorage = () => Promise.resolve();
