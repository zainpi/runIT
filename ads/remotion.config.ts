import { Config } from "@remotion/cli/config";

// Cloud containers ship Chromium without a Remotion download; point at it with
// REMOTION_BROWSER, e.g. /opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
if (process.env.REMOTION_BROWSER) Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(92);
Config.setCodec("h264");
Config.setCrf(18);
Config.setPixelFormat("yuv420p");
