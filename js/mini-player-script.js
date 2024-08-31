const {ipcRenderer} = require("electron");
const remote = require("@electron/remote");

var currentMode = 1;

var shuffleButton = document.getElementById("shuffle-button");
var seekBackButton = document.getElementById("prev-button");
var pausePlayButton = document.getElementById("pause-play-button");
var seekNextButton = document.getElementById("next-button");
var loopButton = document.getElementById("repeat-button");
var songInfoContainer = document.getElementsByClassName("song-info")[0];
var miniPlayerController = document.getElementsByClassName("mp-controller")[0];
var windowIcon = document.getElementsByClassName("win-icon")[0];
var switchModeButton = document.getElementById("switch-mode-but");
var backgroundContainer = document.getElementById("bg-container");
var mainContainer = document.getElementById("main-container");

shuffleButton.onclick = () => ipcRenderer.send("controlPlayBack", "toggle-shuffle");
seekBackButton.onclick = () => ipcRenderer.send("controlPlayBack", "seekBackward");
pausePlayButton.onclick = () => ipcRenderer.send("controlPlayBack", "play/pause");
seekNextButton.onclick = () => ipcRenderer.send("controlPlayBack", "seekForward");
loopButton.onclick = () => ipcRenderer.send("controlPlayBack", "toggle-loop");

document.getElementById("close-button").onclick = () => {remote.getCurrentWindow().close()};
switchModeButton.onclick = () => {
    if (currentMode) {
        songInfoContainer.style.display = "none";
        windowIcon.style.width = "9px";
        windowIcon.style.height = "18px";
        miniPlayerController.style.paddingTop = "27px";
        currentMode = 0;
        switchModeButton.title = "Show Song Info";
        remote.getCurrentWindow().setSize(270, 108);
    }
    else {
        songInfoContainer.style.display = "block";
        miniPlayerController.style.paddingTop = "0px";
        windowIcon.style.width = "12px";
        windowIcon.style.height = "12px";
        currentMode = 1;
        switchModeButton.title = "Hide Song Info";
        remote.getCurrentWindow().setSize(270, 225);
    };
};

var miniPlayerSlider = document.getElementById("playback-slider");
var miniPlayerSliderOverLay = document.getElementById("pb-slider-overlay");
var timePlayedElement = document.getElementById("played-position");
var musicDurationElement = document.getElementById("music-length");
var miniPlayerSliderOnHold = false;
miniPlayerSlider.onmousedown = () => {miniPlayerSliderOnHold = true};
miniPlayerSlider.onmouseup = () => {miniPlayerSliderOnHold = false};
miniPlayerSlider.onchange = () => {ipcRenderer.send("controlPlayBack", "changePlayPosition", miniPlayerSlider.value)};

ipcRenderer.on("updateSongInfo", (event, title, artist, album) => {
    document.getElementById("song-title").innerHTML = title;
    document.getElementById("song-artist").innerHTML = artist;
    document.getElementsByClassName("album")[0].style.backgroundImage = album;
    backgroundContainer.style.backgroundImage = album;
});

ipcRenderer.on("updatePlayBackInfo", (event, percentPlayed, timePlayed, musicDuration) => {
    if (!miniPlayerSliderOnHold) {miniPlayerSlider.value = percentPlayed};
    timePlayedElement.innerHTML = timePlayed;
    musicDurationElement.innerHTML = musicDuration;
    miniPlayerSliderOverLay.style.width = `${percentPlayed}%`;
});

ipcRenderer.on("updateControlButtons", (event, playState, shuffleState, loopState) => {
    if (!playState) {
        document.getElementById("pause-play-button").title = "Play";
        document.getElementById("pause-icon").setAttributeNS(null, "display", "none");
        document.getElementById("play-icon").setAttributeNS(null, "display", "block");
    }
    else {
        document.getElementById("pause-play-button").title = "Pause";
        document.getElementById("pause-icon").setAttributeNS(null, "display", "block");
        document.getElementById("play-icon").setAttributeNS(null, "display", "none");
    };
    if (!shuffleState) {shuffleButton.classList.remove("active-button")}
    else {shuffleButton.classList.add("active-button")};
    if (!loopState) {loopButton.classList.remove("active-button")}
    else {loopButton.classList.add("active-button")};
})

window.onblur = () => {backgroundContainer.style.opacity = "0.09"; mainContainer.style.backgroundColor = "rgb(0, 0, 0, 0.18)";};
window.onfocus = () => {backgroundContainer.style.opacity = "0.72"; mainContainer.style.backgroundColor = "rgb(0, 0, 0, 0.36)";};