// 始终使用暗色主题
document.documentElement.setAttribute('theme', 'dark');

let showBanner = localStorage.getItem("showBanner");
if (showBanner == null || showBanner == undefined || showBanner == "true") {
    document.documentElement.setAttribute('showBanner', true)
} else {
    document.documentElement.setAttribute('showBanner', false)
}
