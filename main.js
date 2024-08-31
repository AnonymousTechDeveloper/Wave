const {BrowserWindow, app, ipcMain, dialog} = require("electron");
const url = require("url");
const path = require("path");
const remoteMain = require("@electron/remote/main");
const { unlink, writeFile } = require("fs");

remoteMain.initialize();
let window;
let miniPlayerWin;

function createWindow() {
    window = new BrowserWindow({
        width: 900, 
        height: 600, 
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            show: false
        },
        minHeight: 360,
        minWidth: 720,
    });
    remoteMain.enable(window.webContents);
    window.setMenu(null);
    window.loadURL(url.format({
        pathname: path.join(__dirname, "index.html"),
        protocol: "file:",
        slashes: true
    }));
    window.setIcon("favicon.ico");
    window.on("ready-to-show", () => {
        window.show();
        let argList = process.argv;
        window.webContents.send("loadData", argList.splice(2, argList.length))
    });
    window.setThumbarButtons([
        {
            tooltip: "Seek Backward",
            icon: path.join(__dirname, "assets/icons/seek-backward-button.ico"),
            click() {window.webContents.send("controlPlayBack", "seekBackward")}
        },
        {
            tooltip: "Pause",
            icon: path.join(__dirname, "assets/icons/pause-button.ico"),
            click() {window.webContents.send("controlPlayBack", "play/pause")}
        },
        {
            tooltip: "Seek Forward",
            icon: path.join(__dirname, "assets/icons/seek-forward-button.ico"),
            click() {window.webContents.send("controlPlayBack", "seekForward")}
        }
    ]);
    ipcMain.on("controlPlayBack", (event, ...args) => {window.webContents.send("controlPlayBack", ...args);});
    ipcMain.on("updateSongInfo", (event, ...songInfo) => {if (miniPlayerWin) {miniPlayerWin.webContents.send("updateSongInfo", ...songInfo);}});
    ipcMain.on("updatePlayBackInfo", (event, ...args) => {if (miniPlayerWin) {miniPlayerWin.webContents.send("updatePlayBackInfo", ...args);}});
    ipcMain.on("updateControlButtons", (event, ...args) => {
        if (miniPlayerWin) {miniPlayerWin.webContents.send("updateControlButtons", ...args);};
        if (!args[0]) {
            message = "Play";
            iconFile = "assets/icons/play-button.ico";
        }
        else {
            message = "Pause";
            iconFile = "assets/icons/pause-button.ico";
        };
        window.setThumbarButtons([
            {
                tooltip: "Seek Backward",
                icon: path.join(__dirname, "assets/icons/seek-backward-button.ico"),
                click() {window.webContents.send("controlPlayBack", "seekBackward")}
            },
            {
                tooltip: message,
                icon: path.join(__dirname, iconFile),
                click() {window.webContents.send("controlPlayBack", "play/pause")}
            },
            {
                tooltip: "Seek Forward",
                icon: path.join(__dirname, "assets/icons/seek-forward-button.ico"),
                click() {window.webContents.send("controlPlayBack", "seekForward")}
            }
        ]);
    });
    ipcMain.on("miniPlayerRequest", (event, ...songInfo) => {createMiniPlayer(...songInfo)});
    window.on("close", () => {
        if (miniPlayerWin) {miniPlayerWin.close()};
        unlink(path.join(__dirname, "tempThumbNail.png"), () => {});
    })
    ipcMain.on("closeMainWin", (event, playBackInfo, currentPlayPos) => {
        if (dialog.showMessageBoxSync({message: "Do you want to save the current configurations and playlist?", type: "question", buttons: ["Yeah", "Nope"], defaultId: 0, title: "Save Info?", detail: "This will override the previous settings and playlist. \nClicking 'Nope' or the Close button will cancel the save."}) !== 0) {return}
        playBackInfo.currentPlayPos = currentPlayPos
        jsonPlayBackInfo = JSON.stringify(playBackInfo);
        writeFile(path.join(__dirname, "savedData.json"), jsonPlayBackInfo, () => {});
    });
    ipcMain.on("ondragstart", (event, filePath) => {
        event.sender.startDrag({file: filePath})
        console.log(filePath)
    })
};

async function createMiniPlayer(...args) {
    [title, artist, album, playState, shuffleState, loopState] = args;
    if (miniPlayerWin === null) {miniPlayerInitializedOnce = true}
    else {miniPlayerInitializedOnce = false};
    if (!(miniPlayerWin === null || miniPlayerWin === undefined)) {miniPlayerWin.focus(); return};
    miniPlayerWin = new BrowserWindow({
        height: 225,
        width: 270,
        show: false,
        minimizable: false,
        maximizable: false,
        resizable: false,
        alwaysOnTop: true,
        frame: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }
    });
    miniPlayerWin.setMenu(null);
    miniPlayerWin.setIcon("favicon.ico");
    miniPlayerWin.setSkipTaskbar(true);
    remoteMain.enable(miniPlayerWin.webContents);
    miniPlayerWin.loadURL(`file://${__dirname}/mini-player.html`);
    miniPlayerWin.webContents.on("dom-ready", () => {
        miniPlayerWin.show(); 
        miniPlayerWin.webContents.send("updateSongInfo", title, artist, album);
        miniPlayerWin.webContents.send("updateControlButtons", playState, shuffleState, loopState);
    });
    miniPlayerWin.on('close', () => {miniPlayerWin = null;});
    miniPlayerWin.on('closed', () => {miniPlayerWin = null;});
}

app.whenReady().then(() => {
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        if (miniPlayerWin === null) {createMiniPlayer};
    });
});
app.on("window-all-closed", () => {
    if (process.platform !== 'darwin') app.quit();
});