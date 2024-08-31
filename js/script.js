const getLyrics = require('genius-lyrics-api').getLyrics;
const fs = require("fs");
const path = require("path");
//const mutag = require("mutag")
const musicmetadata = require("musicmetadata");
const remote = require('@electron/remote');
const { dialog } = remote;
const { ipcRenderer } = require("electron");
const { randomInt } = require('crypto');
const ffmetadata = require("ffmetadata")
require('dotenv').config()

const allowedExtensions = /(\.mp3|\.ogg|\.wav)$/i;

window.addEventListener("keyup", (e) => {
    if (e.code == "Space" && !e.altKey) {controlPlayBack("play/pause")}
    else if (e.code == "KeyS" && e.altKey) {controlPlayBack("toggle-shuffle")}
    else if (e.code == "KeyL" && e.altKey) {controlPlayBack("toggle-loop")}
    else if (e.code == "KeyM" && e.altKey) {controlPlayBack("toggle-mute")}
    else if (e.code == "ArrowLeft" && e.altKey) {playPrevious();}
    else if (e.code == "ArrowRight" && e.altKey) {playNext();}
    else if (e.code == "ArrowUp") {
        if (playBackInfo.volume <= 95) {playBackInfo.volume = parseInt(playBackInfo.volume) + 5}
        else {playBackInfo.volume = 100};
        volumeSlider.value = playBackInfo.volume;
        audioPlayer.volume = playBackInfo.volume/100;
    }
    else if (e.code == "ArrowDown") {
        if (playBackInfo.volume >= 5) {playBackInfo.volume -= 5}
        else {playBackInfo.volume = 0};
        volumeSlider.value = playBackInfo.volume;
        audioPlayer.volume = playBackInfo.volume/100;
    }
    else if (e.code == "ArrowRight" && !e.altKey) {
        let playPosition = audioPlayer.currentTime;
        if (musicDuration - playPosition > 5) {audioPlayer.currentTime += 5}
        else {playNext()};
    } 
    else if (e.code == "ArrowLeft" && !e.altKey) {
        let playPosition = audioPlayer.currentTime;
        if (playPosition > 5) {audioPlayer.currentTime -= 5}
        else {audioPlayer.currentTime = 0};
    }
})
window.onbeforeunload = () => {ipcRenderer.send("closeMainWin", playBackInfo, audioPlayer.currentTime)}
window.onerror = (message, url, line, column, error) => {
    showNotification("Internal Error", `An error has been detected while the runtime of the application, you may report it in the <b>Issues</b> sectiion of the GitHub repository. You can check the complete error in the <b>error.log</b> file. <br><br>Error: ${message}`)
    fs.appendFileSync("./error.log", `${new Date().toString()}
    Error: ${message}
    File: ${url}
    Line: ${line}
    Column: ${column}
    Additional information: ${error}
`, "UTF-8", {'flags': 'a+'})
}

function makeCircleHoleClipPathRule(radius) {
    const inner_path = [];
    const circumference = Math.PI * radius;
    const step = Math.PI * 2 / circumference;
    
    const start_step = circumference * (5 / 8);
    for (let i = start_step; i < circumference + start_step; i++) {
        const angle = step * i;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const str = `calc(${x + 50}%) calc(${y + 50}%)`;
        inner_path.push(str);
    }
    inner_path.push(inner_path[0]);
  
    return `polygon(evenodd,
        -10% -10%,
        110% -10%,
        110% 110%,
        -10% 110%,
        -10% -10%,
        ${inner_path.join(",")}
    )`;
}

var isOnline = true;
var metaDataList = []

var musicDuration = 0;
var playBackSliderOnHold = false;

const vinylAlbum = document.getElementById("album")
const audioPlayer = document.getElementById("player-tag");
const playBackSlider = document.getElementById("playbk-slider");
const volumeSlider = document.getElementById("vol-slider");
const shuffleButton = document.getElementById("shuffle-button");
const seekBackwardButton = document.getElementById("prev-button");
const pausePlayButton = document.getElementById("pause-play-button");
const seekForwardButton = document.getElementById("next-button");
const repeatButton = document.getElementById("repeat-button");
const muteButton = document.getElementById("mute-button");
const playedTimeStampLabel = document.getElementById("played-position");
const musicLengthLabel = document.getElementById("music-length");
const openFileButton = document.getElementById("add-file-but");
const openFolderButton = document.getElementById("open-folder-but");
const getLyricsButton = document.getElementById("lyrics-button");
const openMiniPlayerButton = document.getElementById("mini-player-but");
const albumContainer = document.getElementsByClassName("album-bg")[0];
const lyricsContainerBackground = document.getElementsByClassName("lyrics-cont-bg")[0];
const lyricsContainer = document.getElementsByClassName("lyrics-cont")[0];
const closeLyricsButton = document.getElementsByClassName("close-lyrics")[0];
const playListContainer = document.getElementsByClassName("plist")[0];
const notificationContainer = document.getElementById("notification-container");
const dropBoxOverlay = document.getElementsByClassName("drop-box-overlay")[0];
const backgroundImage = document.getElementById("bg-img")
const miniAlbumImage = document.getElementById("mini-album")
const musicTitleName = document.getElementById("music-title")
const musicArtistName = document.getElementById("music-artist")
const playIcon = document.getElementById("play-icon")
const pauseIcon = document.getElementById("pause-icon")
const volumeMutedIcon = document.getElementById("vol-mute-icon")
const volumeUpIcon1 = document.getElementById("vol-up1-icon")
const volumeUpIcon2 = document.getElementById("vol-up2-icon")
const volumeUpIcon3 = document.getElementById("vol-up3-icon")

var previousTrackIndex = 0

vinylAlbum.style.clipPath = makeCircleHoleClipPathRule(5);

dropBoxOverlay.onclick = (event) => {dropBoxOverlay.style.display = "none";}

playBackSlider.value = 0
playBackSlider.onmousedown = () => playBackSliderOnHold = true;
playBackSlider.onmouseup = () => playBackSliderOnHold = false;

audioPlayer.onerror = () => {
    showNotification("Couldn't Play File", `We couldn't play the file <b>${playBackInfo.fileList[playBackInfo.currentMusicIndex]}</b>. <br>Please make sure it is a supported and valid audio file. If the problem still exist, make sure that it exists at the given location and is not currupted.`);
    playBackInfo.fileList.splice(playBackInfo.currentMusicIndex, 1);
    playNext(playBackInfo.currentMusicIndex);
}

ipcRenderer.on("loadData", (event, argList) => {loadData(argList)})

audioPlayer.onloadedmetadata = (event) => {musicDuration = audioPlayer.duration};
audioPlayer.onended = () => playNext();
audioPlayer.ontimeupdate = (event) => {
    if (!playBackSliderOnHold) {playBackSlider.value = parseInt(audioPlayer.currentTime)*100/(musicDuration)};
    let playPosition = audioPlayer.currentTime;
    minutesPlayed = Math.floor(playPosition/ 60);
    secondsPlayed = Math.floor(playPosition % 60);
    minutesLength = Math.floor(musicDuration/60);
    secondsLength = Math.floor(musicDuration % 60);
    timePlayedText = `${minutesPlayed}:${secondsPlayed > 9 ? secondsPlayed : "0" + secondsPlayed}`;
    musicDurationText = `${minutesLength}:${secondsLength> 9 ? secondsLength : "0" + secondsLength}`;
    playedTimeStampLabel.innerHTML = timePlayedText;
    musicLengthLabel.innerHTML = musicDurationText;
    ipcRenderer.send("updatePlayBackInfo", playBackSlider.value, timePlayedText, musicDurationText);
}

playBackSlider.onchange = (event) => {audioPlayer.currentTime = playBackSlider.value*musicDuration/100};

shuffleButton.onclick = () => controlPlayBack("toggle-shuffle");
seekBackwardButton.onclick = () => playPrevious();
pausePlayButton.onclick = () => controlPlayBack("play/pause");
seekForwardButton.onclick = () => playNext();
repeatButton.onclick = () => controlPlayBack("toggle-loop");
muteButton.onclick = () => controlPlayBack("toggle-mute");
volumeSlider.onchange = () => {
    playBackInfo.volume = volumeSlider.value;
    if (!playBackInfo.isMuted) {audioPlayer.volume = playBackInfo.volume/100;}
}
getLyricsButton.onclick = () => {
    lyricsContainerBackground.style.display = "block";
    albumContainer.style.display = "none";
}
closeLyricsButton.onclick = () => {
    lyricsContainerBackground.style.display = "none";
    albumContainer.style.display = "block";
}
openFileButton.onclick = () => addSong("openFile");
openFolderButton.onclick = () => addSong("openDirectory");
openMiniPlayerButton.onclick = () => {
    let title = musicTitleName.innerHTML;
    let artist = musicArtistName.innerHTML;
    let album = vinylAlbum.style.backgroundImage;
    ipcRenderer.send("miniPlayerRequest", title, artist, album, playBackInfo.playing, playBackInfo.isShuffling, playBackInfo.isOnLoop);
}

randomInteger = (minValue, maxValue) => Math.floor(Math.random()*maxValue + minValue);
ipcRenderer.on("controlPlayBack", (event, ...args) => {controlPlayBack(...args)});

function loadData(argList) {
    if (argList.length !== 0) {
        playBackInfo = {
            playing: true,
            volume: 50,
            currentMusicIndex: 0,
            isOnLoop: false,
            isShuffling: false,
            isMuted: false,
            fileList: [],
        }
        argList.forEach((_path, index, container) => {
            if (allowedExtensions.exec(_path)) {playBackInfo.fileList.push(_path)}
            else {
                fs.readdir(_path, (error, filePaths) => {
                    if (!error) {
                        filePaths.forEach((filePath, index, container) => {
                            if (allowedExtensions.exec(filePath)) {playBackInfo.fileList.push(path.join(_path, filePath))}
                            else {showNotification("Invalid File Type", `Seems like the file <b>${path.basename(filePath)}</b> is not a valid audio file or is not supported. It will not be added to the Playlist.`)}
                        });
                    } else {
                        showNotification("Invalid File Type", `Seems like the file <b>${path.basename(_path)}</b> is not a valid audio file, directory or is not supported. It will not be added to the Playlist.`)
                    }
                });
            }
        })
        initializePlayer(0)
    }
    else {
        fs.readFile(path.join(__dirname, "savedData.json"), (error, jsonFileData) => {
            if (jsonFileData) {
                try {fileData = JSON.parse(jsonFileData)}
                catch {error = {code: "InvalidFileDataError"}}
            }
            if (error) {
                if (error.code == "ENOENT") {showNotification("Save File not Found", "We couldn't find the <b>saveData.json</b> file. We'll be creating a new file.")}
                if (error.code == "InvalidFileDataError") {showNotification("Currupted Save File", "It looks like the <b>saveData.json</b> file has been changed or is currupted. We will overwrite this file. <br>Any save data will be lost.")}
                fileData = {
                    playing: true,
                    volume: 50,
                    currentMusicIndex: 0,
                    isOnLoop: false,
                    isShuffling: false,
                    isMuted: false,
                    fileList: [],
                    currentPlayPos: 0
                }
                fs.writeFile(path.join(__dirname, "savedData.json"), JSON.stringify(fileData), (error) => {if (error) {showNotification("Cannot Write File", `An error occured while creating a file for saving the song info. If this error persist for long, you can inform me in the 'Issues' section of my GitHub repository. <br>Error: ${error}`)}})
            }
            let currentPlayPos = fileData.currentPlayPos
            delete fileData.currentPlayPos
            playBackInfo = fileData
            initializePlayer(currentPlayPos)
        })
    }
}

function initializePlayer(currentPlayPos) {
    if ("mediaSession" in navigator) {
        mediaSession = navigator.mediaSession;
        trackInfo = {};
        mediaMetaData = new MediaMetadata(trackInfo);
        mediaSession.metadata = mediaMetaData;
        mediaSession.setActionHandler("pause", () => {controlPlayBack("play/pause")})
        mediaSession.setActionHandler("play", () => {controlPlayBack("play/pause")})
        mediaSession.setActionHandler("nexttrack", () => {playNext()})
        mediaSession.setActionHandler("previoustrack", () => {playPrevious()})
    }
    playIcon.setAttributeNS(null, "display", "none");
    volumeMutedIcon.setAttributeNS(null, "display", "none");
    audioPlayer.volume = playBackInfo.volume/100
    volumeSlider.value = playBackInfo.volume
    if (playBackInfo.isOnLoop) {playBackInfo.isOnLoop = false; controlPlayBack("toggle-loop")}
    if (playBackInfo.isShuffling) {playBackInfo.isShuffling = false; controlPlayBack("toggle-shuffle")}
    if (playBackInfo.isMuted) {playBackInfo.isMuted = false; controlPlayBack("toggle-mute")}
    vinylAlbum.style.animationPlayState = "running";
    playNext(playBackInfo.currentMusicIndex)
    audioPlayer.currentTime = currentPlayPos
    if (!playBackInfo.playing || !playBackInfo.fileList.length) {playBackInfo.playing = true; controlPlayBack("play/pause")}
    extractMetaData(0)
}

function playNext(musicIndex) {
    if (playBackInfo.fileList.length === 0) {
        showNotification("The Playlist is Empty", "It seems there are no songs in your playlist to play. Add some songs from your device and have fun!");
        audioPlayer.currentTime = 0;
        if (audioPlayer.readyState) {audioPlayer.play()};
        return;
    }
    previousTrackIndex = playBackInfo.currentMusicIndex
    if (!playBackInfo.isOnLoop) {playBackInfo.currentMusicIndex++};
    if (playBackInfo.isShuffling && !musicIndex) {playBackInfo.currentMusicIndex = randomInt(1, playBackInfo.fileList.length + 1)};
    if (playBackInfo.currentMusicIndex >= playBackInfo.fileList.length) {playBackInfo.currentMusicIndex = 0};
    if (typeof musicIndex === "number") {playBackInfo.currentMusicIndex = musicIndex};
    lyricsContainer.innerHTML = "Please wait while we fetch the lyrics of this song.";
    setMusicThumbNail();
    audioPlayer.src = playBackInfo.fileList[playBackInfo.currentMusicIndex];
    if (!playBackInfo.isMuted) {audioPlayer.volume = playBackInfo.volume/100};
    if (playBackInfo.playing) {audioPlayer.play()};
    updateActiveMusicElement()
    //extractMetaData(0);
}

function playPrevious() {
    let currentlyPlayingSongIndex = playBackInfo.currentMusicIndex
    if (playBackInfo.fileList.length === 0) {
        showNotification("The Playlist is Empty", "It seems there are no songs in your playlist to play. Add some songs from your device and have fun!");
        audioPlayer.currentTime = 0;
        return;
    }
    if (audioPlayer.currentTime < 5) {
        //if (playBackInfo.isShuffling) {playBackInfo.currentMusicIndex = randomInt(1, playBackInfo.fileList.length + 1)};
        if (!playBackInfo.isOnLoop) {playBackInfo.currentMusicIndex = (previousTrackIndex !== playBackInfo.currentMusicIndex) ? previousTrackIndex : randomInt(1, playBackInfo.fileList.length + 1);};};
    if (playBackInfo.currentMusicIndex < 0) {playBackInfo.currentMusicIndex = playBackInfo.fileList.length - 1};
    setMusicThumbNail();
    audioPlayer.src = playBackInfo.fileList[playBackInfo.currentMusicIndex];
    if (!playBackInfo.isMuted) {audioPlayer.volume = playBackInfo.volume/100};
    if (playBackInfo.playing) {audioPlayer.play()};
    previousTrackIndex = currentlyPlayingSongIndex
    updateActiveMusicElement()
    //extractMetaData(0);
    //updateDiscordStatus()
}

function removeSong(index) {
    playBackInfo.fileList.splice(index, 1);
    if (index < playBackInfo.currentMusicIndex) {playBackInfo.currentMusicIndex--};
    if (index == playBackInfo.currentMusicIndex) {playNext()}
    else {extractMetaData(0)}
}

function setMusicThumbNail() {
    parser = musicmetadata(fs.createReadStream(playBackInfo.fileList[playBackInfo.currentMusicIndex]), (error, metadata) => {
        if (error) {
            showNotification(`Album Cover Extraction Error", "Album cover extraction failed for this song. This might be due to missing album cover in this file or due to use of an unsupported image format for the cover. \n\nError: ${error}`);
            return
        };
        titleText = musicTitleName;
        artistText = musicArtistName;
        if (metadata.title === "") {metadata.title = path.basename(playBackInfo.fileList[playBackInfo.currentMusicIndex], path.extname(playBackInfo.fileList[playBackInfo.currentMusicIndex]))};
        titleText.innerHTML = metadata.title;
        titleText.title = metadata.title;
        if (metadata.artist[0] === undefined) {metadata.artist[0] = ''};
        artistText.innerHTML = metadata.artist[0];
        artistText.title = metadata.artist[0];
        try {
            thumbNailData = metadata.picture[0].data;
            fs.writeFile(path.join(__dirname, `tempThumbNail.${metadata.picture[0].format}`), thumbNailData, () => {
                backgroundImage.style.backgroundImage = `url(tempThumbNail.jpg?${new Date().getTime()})`;
                miniAlbumImage.style.backgroundImage = `url(tempThumbNail.jpg?${new Date().getTime()})`;
                vinylAlbum.style.backgroundImage = `url(tempThumbNail.jpg?${new Date().getTime()})`;
                ipcRenderer.send("updateSongInfo", metadata.title, metadata.artist[0], `url(tempThumbNail.jpg?${new Date().getTime()})`);
            });
        }
        catch (error){
            backgroundImage.style.backgroundImage = `url(assets/images/background_img.jpg)`;
            miniAlbumImage.style.backgroundImage = `url(assets/images/cassete_image.jpg)`;
            vinylAlbum.style.backgroundImage = `url(assets/images/cassete_image.jpg)`;
            ipcRenderer.send("updateSongInfo", titleText, artistText, `url(assets/images/cassete_image.jpg)`);
        };
        updateLyrics(metadata.title, metadata.artist[0]);
        syncMetaDataWithOS(metadata.title, metadata.artist, "")
    })
}

function syncMetaDataWithOS(title, artist, albumSource) {
    if ("mediaSession" in navigator) {fs.readFile(path.join(__dirname, "tempThumbNail.jpg"), (error, data) => {
            let url = URL.createObjectURL(new Blob([data]), {type: 'image/jpg'})
            trackInfo.title = title;
            trackInfo.artist = artist;
            trackInfo.artwork = [{src: url}];
            let mediaMetaData = new MediaMetadata(trackInfo);
            mediaSession.metadata = mediaMetaData;
        })
    }  
}

function updateActiveMusicElement() {
    try {
        document.getElementsByClassName("active-song")[0].classList.remove("active-song");
        let newActiveMusicElement = document.getElementsByClassName("music-element")[playBackInfo.currentMusicIndex]
        newActiveMusicElement.classList.add("active-song");
        newActiveMusicElement.scrollIntoView();
    } catch (error) {}
}

async function extractMetaData(index, loadAll = false) {
    if (playBackInfo.fileList.length == 0) {
        playListContainer.innerHTML = `
            <p class="message-para">Whoopsie, your playlist seems to be empty, no worries you can always add some. <br><br>Click the <svg class="icon para-icon"><use xlink:href="#music-file-icon"></use></svg> button to add a song or <svg class="icon para-icon"><use xlink:href="#folder-icon"></use></svg> button to add all songs from a folder from your computer and enjoy them.</p>
        `; 
        return;
    }; 
    let file = playBackInfo.fileList[index];
    let fileData = fs.createReadStream(file);
    fileData.on("error", (error) => {
        index++; 
        if (index < playBackInfo.fileList.length) {
            extractMetaData(index); 
            playBackInfo.fileList.splice(index - 1, 1);
            if (index < playBackInfo.currentMusicIndex) {playBackInfo.currentMusicIndex--};
            showNotification("Invalid File Found", `It seems that the file <b>${file}</b> is not a valid audio file, is currupted or does not exist at the given location. <br>It has been removed from the playlist.`);
        };
    })
    musicmetadata(fileData, (error, metadata) => {
        if (error) {
            return;
        }
        if (metadata.artist[0] === undefined) {metadata.artist[0] = ""};
        if (metadata.title === "") {metadata.title = path.basename(file, path.extname(file))};
        metaDataList[index] = {
            title: metadata.title,
            artist: metadata.artist[0]
        };
        index++;
        if (index < playBackInfo.fileList.length) {extractMetaData(index)}
        else {
            playListContainer.innerHTML = "";
            metaDataList.forEach((element, index, container) => {
                playListContainer.innerHTML += `
                    <div class="music-element ${(index === playBackInfo.currentMusicIndex) ? 'active-song' : ''}">
                        <div class="prev-desc">
                            <div class="prev-title" title="${element.title}">${element.title}</div>
                            <div class="prev-artist" title="${element.artist}">${element.artist}</div>
                        </div>
                        <div class="prev-cont">
                            <div class="playbk-cont-but prev-but" onclick="playNext(${index})" title="Play This Song"><svg class="icon"><use xlink:href="#play-song-icon"></use></svg></div>
                            <div class="playbk-cont-but prev-but" onclick="removeSong(${index})" title="Remove This Song from the Playlist"><svg class="icon"><use xlink:href="#close-icon"></use></svg></div>
                        </div>
                    </div>
                `;
            });
            if (document.getElementsByClassName("active-song")) {document.getElementsByClassName("active-song")[0].scrollIntoView()};
            metaDataList = [];
        }
    })
}

function controlPlayBack(command, value) {
    if (command === "play/pause") {
        if (playBackInfo.playing) {
            pausePlayButton.title = "Play";
            pauseIcon.setAttributeNS(null, "display", "none");
            playIcon.setAttributeNS(null, "display", "block");
            vinylAlbum.style.animationPlayState = "paused";
            audioPlayer.pause();
        }
        else {
            if (!audioPlayer.readyState) {return};
            pausePlayButton.title = "Pause";
            pauseIcon.setAttributeNS(null, "display", "block");
            playIcon.setAttributeNS(null, "display", "none");
            vinylAlbum.style.animationPlayState = "running";
            audioPlayer.play();
        };
        playBackInfo.playing = !playBackInfo.playing;
    }
    else if (command === "toggle-shuffle") {
        if (playBackInfo.isShuffling) {shuffleButton.classList.remove("active-but")}
        else {
            shuffleButton.classList.add("active-but");
            if (playBackInfo.isOnLoop) {controlPlayBack("toggle-loop")};
        };
        playBackInfo.isShuffling = !playBackInfo.isShuffling;
    }
    else if (command === "toggle-loop") {
        if (playBackInfo.isOnLoop) {repeatButton.classList.remove("active-but")}
        else {
            repeatButton.classList.add("active-but");
            if (playBackInfo.isShuffling) {controlPlayBack("toggle-shuffle")};
        };
        playBackInfo.isOnLoop = !playBackInfo.isOnLoop;
    }
    else if (command === "toggle-mute") {
        if (playBackInfo.isMuted) {
            muteButton.getElementsByTagName("*")[0].classList.replace("fa-volume-xmark", "fa-volume-high");
            volumeMutedIcon.setAttributeNS(null, "display", "none")
            volumeUpIcon1.setAttributeNS(null, "display", "block")
            volumeUpIcon2.setAttributeNS(null, "display", "block")
            volumeUpIcon3.setAttributeNS(null, "display", "block")
            audioPlayer.volume = playBackInfo.volume/100;
        }
        else {
            volumeMutedIcon.setAttributeNS(null, "display", "block")
            volumeUpIcon1.setAttributeNS(null, "display", "none")
            volumeUpIcon2.setAttributeNS(null, "display", "none")
            volumeUpIcon3.setAttributeNS(null, "display", "none")
            audioPlayer.volume = 0;
        };
        playBackInfo.isMuted = !playBackInfo.isMuted;
    }
    else if (command === "seekBackward") {playPrevious()}
    else if (command === "seekForward") {playNext()}
    else if (command === "changePlayPosition") {audioPlayer.currentTime = value*musicDuration/100}
    ipcRenderer.send("updateControlButtons", playBackInfo.playing, playBackInfo.isShuffling, playBackInfo.isOnLoop);
}

function rearrangePlayList(selectedElementIndex, updatedElementIndex) {
    selectedSong = playBackInfo.fileList.splice(selectedElementIndex, 1)[0];
    if (updatedElementIndex > selectedElementIndex) {updatedElementIndex--};
    playBackInfo.fileList.splice(updatedElementIndex, 0, selectedSong);
    if (selectedElementIndex == playBackInfo.currentMusicIndex) {playBackInfo.currentMusicIndex = updatedElementIndex};
    if (selectedElementIndex < playBackInfo.currentMusicIndex && updatedElementIndex >= playBackInfo.currentMusicIndex) {playBackInfo.currentMusicIndex--}
    else if (selectedElementIndex > playBackInfo.currentMusicIndex && updatedElementIndex <= playBackInfo.currentMusicIndex) {playBackInfo.currentMusicIndex++};
    extractMetaData(0);
}

function addSong(option) {
    dialog.showOpenDialog({properties: [option, "multiSelections"]}).then((result) => {
        if (!result.canceled) {
            if (option === "openDirectory") {
                playBackInfo.fileList = [];
                playListContainer.innerHTML = "";
                fs.readdir(result.filePaths[0], (error, filePaths) => {
                    if (!error) {
                        filePaths.forEach((filePath, index, container) => {
                            if (allowedExtensions.exec(filePath)) {playBackInfo.fileList.push(path.join(result.filePaths[0], filePath))}
                            else {showNotification("Invalid File Type", `Seems like the file <b>${path.basename(filePath)}</b> is not a valid audio file or is not supported. It will not be added to the Playlist.`)}
                        });
                        extractMetaData(0);
                        playNext(0);
                    };
                });
            }
            else {
                result.filePaths.forEach((filePath, index, container) => {
                    if (allowedExtensions.exec(filePath)) {playBackInfo.fileList.push(filePath)}
                    else {showNotification("Invalid File Type", `Seems like the file <b>${path.basename(filePath)}</b> is not a valid audio file or is not supported. It will not be added to the Playlist.`)};
                });
                extractMetaData(0);
                if (playBackInfo.fileList.length === 1) {playNext(0); audioPlayer.currentTime = 0;}
            };
        };
    });
};

async function updateLyrics(title, artist) {
    //localLyrics()
    //return
    let lyricAPIOptions = {
        apiKey: process.env.GENIUS_API_TOKEN,
        title: title,
        artist: artist,
        optimizeQuery: true
    };
    getLyrics(lyricAPIOptions).then((lyrics) => {
        if (lyrics === null) lyrics = "We couldn't find lyrics for this song."
        lyrics = lyrics.replace(/\n/g, "<br>");
        lyricsContainer.innerHTML = lyrics;
        lyricsContainer.scrollTo(0, 0);
        if (!isOnline) {showNotification("Back Online", "We found that you're connected back to the internet. Lyrics of the song will be shown from next track, if we could find it.")}
        isOnline = true;
    }).catch((error) => {
        lyricsContainer.innerHTML = `Failed to fetch lyrics for the current song. <br><br>${error}`;
        if (error == "Error: Network Error") {
            if (isOnline) {
                showNotification("Not Connected to Internet", "It seems you're not connected to a stable network right now. We will not be able to get song lyrics till you're offline. <br>Try connecting to a stable network and try again.")
                isOnline = false;
            }
        }
        if (error == '"artist" property is missing from options') {showNotification("Failed to get Song Lyrics", "The audio file does not contain sufficient information to extract lyrics for it. Please make sure that it contains both Song Title and Artist name in the file's metadata.")}
    })}

function showNotification(title, description) {
    notificationContainer.style.pointerEvents = "all";
    let thisElement = document.createElement("div");
    thisElement.classList.add("notify-tile");
    notificationContainer.appendChild(thisElement);
    let timeOutId = setTimeout(clearNotification, 9000, thisElement);
    thisElement.innerHTML += `
        <div class="close-notify-button" title="Close Notification"><svg class="icon"><use xlink:href="#close-icon"></use></svg></div>
        <div class="notify-title">${title}</div>
        <div class="notify-desc">${description}</div>
    `;
    thisElement.getElementsByClassName("close-notify-button")[0].onclick = () => {clearNotification(thisElement); clearTimeout(timeOutId)};
};

function clearNotification(element) {
    element.style.opacity = "0";
    setTimeout(() => {
        element.remove();
        if (notificationContainer.innerHTML === "") {notificationContainer.style.pointerEvents = "none";};
    }, 900);
};

$(".plist").sortable({
    start: function(event, element) {selectedElementIndex = element.item.index()},
    change: function(event, element) {updatedElementIndex = element.placeholder.index()},
    stop: function(event, element) {if (selectedElementIndex != updatedElementIndex) {rearrangePlayList(selectedElementIndex, updatedElementIndex)}}
});

document.body.ondragenter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dropBoxOverlay.style.display = "block";
};

document.body.ondragover = (event) => {
    event.preventDefault();
    event.stopPropagation();
}

document.body.ondrop = (event) => {
    event.preventDefault();
    event.stopPropagation();

    dropBoxOverlay.style.display = "none";
    var fileList = event.dataTransfer.files;
    var fileIndexList = Object.keys(fileList)
    if (playBackInfo.fileList.length === 0) var emptyList = true;
    fileIndexList.forEach((value, index, container) => {
        var filePath = fileList[value].path;
        if (allowedExtensions.exec(filePath)) {
            playBackInfo.fileList.push(filePath); 
            showNotification("Music Added", `The file <b>${path.basename(filePath)}</b> has been successfully added to your Playlist.`)
        }
        else {showNotification("Invalid File Type", `Seems like the file <b>${path.basename(filePath)}</b> is not a valid audio file or is not supported. It will not be added to the Playlist.`)};
        if (index === (fileIndexList.length - 1)) {extractMetaData(0);};
    });
    if (emptyList) playNext(0);
}

async function extractMetaDataNew(...args) {
    if (playBackInfo.fileList.length == 0) {
        playListContainer.innerHTML = `
            <p class="message-para">Whoopsie, your playlist seems to be empty, no worries you can always add some. <br><br>Click the <svg class="icon para-icon"><use xlink:href="#music-file-icon"></use></svg> button to add a song or <svg class="icon para-icon"><use xlink:href="#folder-icon"></use></svg> button to add all songs from a folder from your computer and enjoy them.</p>
        `; 
        return;
    };
    //index = 0
    let metaDataList = []
    playListContainer.innerHTML = ""
    for await (const file of playBackInfo.fileList) {
        let fileData = fs.createReadStream(file)
        fileData.on("error", (_error) => {
            playBackInfo.fileList.remove(file);
        })
        musicmetadata(fileData, (error, metadata) => {
            if (error) { return; }
            if (metadata.artist[0] === undefined) { metadata.artist[0] = ""; };
            if (metadata.title === "") { metadata.title = path.basename(file, path.extname(file)); };
            metaDataList.push((metadata.title, metadata.artist));
            console.log('Chekpoint ');
        })
        //index++;
        console.log("a")
    }
    console.log("b", metaDataList)
    metaDataList.forEach((element, index, _container) => {
        console.log("c")
        playListContainer.innerHTML += `
                <div class="music-element ${(index === playBackInfo.currentMusicIndex) ? 'active-song' : ''}">
                    <div class="prev-desc">
                        <div class="prev-title" title="${element[0]}">${element[0]}</div>
                        <div class="prev-artist" title="${element[1]}">${element[1]}</div>
                    </div>
                    <div class="prev-cont">
                        <div class="playbk-cont-but prev-but" onclick="playNext(${index})" title="Play This Song"><svg class="icon"><use xlink:href="#play-song-icon"></use></svg></div>
                        <div class="playbk-cont-but prev-but" onclick="removeSong(${index})" title="Remove This Song from the Playlist"><svg class="icon"><use xlink:href="#close-icon"></use></svg></div>
                    </div>
                </div>
                `;
    })
    document.getElementsByClassName("active-song")[0].scrollIntoView();
}

async function localLyrics() {
    const metadata = await ffmetadata.read(playBackInfo.fileList[playBackInfo.currentMusicIndex], (err, data) => {
        if (err) {
          console.error('Error reading metadata:', err);
        } else {
          if (data['lyrics-XXX']) {lyricsContainer.innerHTML = data['lyrics-XXX'].replace(/\n/g, '<br>')}
        }
      });
}