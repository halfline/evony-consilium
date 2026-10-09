"""Pinned public snapshot shared by the extraction commands."""

import re

SNAPSHOT = 397319
ANDROID_BASE = "https://emggcdn1.ucimg.co/"
ANDROID_BUNDLES = ANDROID_BASE + "android/UploadBundles/"
WEBGL_BUNDLES = "https://ewggcdn.ucimg.co/webgl/WebBuild/StreamingAssets/AssetsBundles/"

RESOURCE_MANIFEST = (
    "android/UploadBundles/397319_8AF4BA72AD6CF179DE8EBC3B544C232D_download_config.txt"
)
BUNDLE_MAP = "android/UploadBundles/BundleMap-397319.zip"
CONFIG_ARCHIVE = "config_data/9a2957927cfdbab51180f33211aaa9f3.zip"
ENGLISH_ARCHIVE = "config_data/en-US_f0ec476e8fd3042cd98808faa7ac3090.zip"

CULTURES = {
    1: "Europe",
    2: "China",
    3: "Japan",
    4: "Korea",
    5: "America",
    6: "Russia",
    7: "Arabia",
}

_LANGUAGE = re.compile(r'"([^"\r\n]+)"="((?:[^"\\]|\\.)*)";')


def parse_language(text):
    """Read an Evony ``en-US.bytes`` localization table."""
    return dict(_LANGUAGE.findall(text))
