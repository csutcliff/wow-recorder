/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */
import { URL } from 'url';
import path from 'path';
import { categories, months, zones, encountersNathria, encountersSanctum, encountersSepulcher }  from './constants';
import { Metadata }  from './logutils';
const chalk = require('chalk');

/**
 * When packaged, we need to fix some paths
 */
 const fixPathWhenPackaged = (path: string) => {
    return path.replace("app.asar", "app.asar.unpacked");
}

const { exec } = require('child_process');
const ffmpegPath = fixPathWhenPackaged(require('@ffmpeg-installer/ffmpeg').path);
const ffprobePath = fixPathWhenPackaged(require('@ffprobe-installer/ffprobe').path);
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);
const fs = require('fs');
const glob = require('glob');

let videoIndex: { [category: string]: number }  = {};

export let resolveHtmlPath: (htmlFileName: string) => string;

if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 1212;
  resolveHtmlPath = (htmlFileName: string) => {
    const url = new URL(`http://localhost:${port}`);
    url.pathname = htmlFileName;
    return url.href;
  };
} else {
  resolveHtmlPath = (htmlFileName: string) => {
    return `file://${path.resolve(__dirname, '../renderer/', htmlFileName)}`;
  };
}

/**
 * Empty video state. 
 */
const getEmptyState = () => {
    let videoState: { [category: string]: [] } = {};
    for (const category of categories) {
        videoState[category] = [];
    }

    return videoState;
}

/**
 * Load videos from category folders in reverse chronological order.  
 */
const loadAllVideos = (storageDir: any, videoState: any) => {
    const videos = glob.sync(storageDir + "*.mp4")        
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime);

    for (const category of categories) {
        videoIndex[category] = 0;
    }

    for (const video of videos) {            
        loadVideoDetails(video, videoState);
    }        
}

/**
 * Load video details from the metadata and add it to videoState. 
 */
 const loadVideoDetails = (video: any, videoState: any) => {
    const today = new Date();
    const videoDate = new Date(fs.statSync(video.name).mtime)
    const isVideoFromToday = (today.toDateString() === videoDate.toDateString());

    const metadata = getMetadataForVideo(video)
    if (metadata === undefined) return;

    // Hilariously 5v5 is still a war game mode that will break things without this.
    if (!categories.includes(metadata.category)) return;

    videoState[metadata.category].push({
        index: videoIndex[metadata.category]++,
        fullPath: video.name,
        zone: getVideoZone(metadata),
        zoneID: metadata.zoneID,
        encounter: getVideoEncounter(metadata),
        encounterID: metadata.encounterID,
        duration: metadata.duration,
        result: metadata.result, 
        date: getVideoDate(videoDate),
        isFromToday: isVideoFromToday,
        time: getVideoTime(videoDate),
        protected: Boolean(metadata.protected),
        playerSpecID: getPlayerSpec(metadata),
        playerName: getPlayerName(metadata),
        playerRealm: getPlayerRealm(metadata),
        teamMMR: metadata.teamMMR,
    });

}

/**
 * Get the date a video was recorded from the date object.
 */
const getMetadataForVideo = (video: any) => {
    const videoFileName = path.basename(video.name, '.mp4');
    const videoDirName = path.dirname(video.name);
    const metadataFile = videoDirName + "/" + videoFileName + ".json";

    if (fs.existsSync(metadataFile)) {
        const metadataJSON = fs.readFileSync(metadataFile);
        const metadata = JSON.parse(metadataJSON);
        return metadata;
    } else {
        console.log("Metadata file does not exist: ", metadataFile);
        return undefined;
    }
}

/**
 * Get the date a video was recorded from the date object.
 */
 const getMetadataFileForVideo = (video: any) => {
    const videoFileName = path.basename(video, '.mp4');
    const videoDirName = path.dirname(video);
    const metadataFilePath = videoDirName + "/" + videoFileName + ".json";
    return metadataFilePath;
}

/**
 * Get the date a video was recorded from the date object.
 */
const getVideoDate = (date: Date) => {
    const day = date.getDate();
    const month = months[date.getMonth()].slice(0, 3);
    const dateAsString = day + " " + month;
    return dateAsString;
}

/**
 * Get the time a video was recorded from the date object.
 */
const getVideoTime = (date: Date) => {
    const hours = date.getHours().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const mins = date.getMinutes().toLocaleString('en-US', { minimumIntegerDigits: 2});
    const timeAsString = hours + ":" + mins;
    return timeAsString;
}

/**
 * Get the zone name.
 */
const getVideoZone = (metadata: Metadata) => {
    const zoneID = metadata.zoneID;
    const encounterID = metadata.encounterID;
    const category = metadata.category;

    const isRaidEncounter = (category === "Raids") && encounterID; 
    let zone: string;
    
    if (isRaidEncounter) {
        zone = getRaidName(encounterID);
    } else if (zoneID) {
        zone = zones[zoneID];
    } else {
        zone = "Unknown";
    }

    return zone;
}

/**
 * Get the raid name from the encounter ID.
 */
 const getRaidName = (encounterID: number) => {
    let raidName: string;

    if (encountersNathria.hasOwnProperty(encounterID)) {
        raidName = "Castle Nathria";
    } else if (encountersSanctum.hasOwnProperty(encounterID)) {
        raidName = "Sanctum of Domination";
    } else if (encountersSepulcher.hasOwnProperty(encounterID)) {
        raidName = "Sepulcher of the First Ones";
    } else {
        raidName = "Unknown Raid";
    }

    return raidName;
}

/**
 * Get the encounter name.
 */
const getVideoEncounter = (metadata: Metadata) => {
    if (metadata.encounterID) { 
        return zones[metadata.encounterID]; 
    } else {
        return metadata.category; 
    }
}

/**
 * Get the player spec ID.
 */
 const getPlayerSpec = (metadata: Metadata) => {
    if (metadata.playerSpecID) { 
        return metadata.playerSpecID; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player name.
 */
 const getPlayerName = (metadata: Metadata) => {
    if (metadata.playerName) { 
        return metadata.playerName; 
    } else {
        return undefined; 
    }
}

/**
 * Get the player realm.
 */
 const getPlayerRealm = (metadata: Metadata) => {
    if (metadata.playerRealm) { 
        return metadata.playerRealm; 
    } else {
        return undefined; 
    }
}

/**
 * Get the state of all videos. 
 * Returns an empty array if storageDir is undefined. 
 */
const getVideoState = (storageDir: unknown) => {
    let videoState = getEmptyState();
    if (!storageDir) return videoState;
    loadAllVideos(storageDir, videoState);
    return videoState;
}    

/**
 *  writeMetadataFile
 */
const writeMetadataFile = (storageDir: string, metadata: Metadata) => {
    const jsonString = JSON.stringify(metadata, null, 2);
    const newestVideoPath = getNewestVideo(storageDir);
    const newestVideoName = path.basename(newestVideoPath, '.mp4');
    fs.writeFileSync(storageDir + newestVideoName + ".json", jsonString);
}    

/**
 * runSizeMonitor, maxStorage in GB.
 */
const runSizeMonitor = (storageDir: any, maxStorageGB: any) => {
    console.debug("Running size monitor");  
    const maxStorageBytes = maxStorageGB * Math.pow(1024, 3);
    let totalSize = 0;
    const files = fs.readdirSync(storageDir);

    for (const file of files) {
        totalSize += fs.statSync(storageDir + file).size;
    }

    if (totalSize > maxStorageBytes) { 
        deleteOldestVideo(storageDir);
        runSizeMonitor(storageDir, maxStorageBytes);
    } 
}   

/**
 * Delete the oldest video, unprotected video.
 */
const deleteOldestVideo = (storageDir: any) => {
    const sortedVideos = glob.sync(storageDir + "*.mp4")
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => B.mtime - A.mtime)

    let videoForDeletion = sortedVideos.pop();
    let deleteNotAllowed = isVideoProtected(videoForDeletion.name);

    while ((deleteNotAllowed) && (sortedVideos.length > 0)) {
        videoForDeletion = sortedVideos.pop();
        deleteNotAllowed = isVideoProtected(videoForDeletion.name)
    }

    if (!deleteNotAllowed) deleteVideo(videoForDeletion.name);
}  

/**
 * Get the newest video.
 */
 const getNewestVideo = (dir: any): string => {
    const globString = path.join(dir, "*.mp4"); 
    const sortedVideos = glob.sync(globString)
        .map((name: any) => ({name, mtime: fs.statSync(name).mtime}))
        .sort((A: any, B: any) => A.mtime - B.mtime)

    let videoForDeletion = sortedVideos.pop();
    return videoForDeletion.name;
}  

/**
 * isVideoProtected
 */
 const isVideoProtected = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);
    const metadataJSON = fs.readFileSync(metadataPath);
    const metadata = JSON.parse(metadataJSON);
    return Boolean(metadata.protected);
}  

/**
 * Delete a video and its metadata file if it exists. 
 */
 const deleteVideo = (videoPath: string) => {
    const metadataPath = getMetadataFileForVideo(videoPath);

    if (fs.existsSync(metadataPath)) {
        console.log("Deleting: " + metadataPath);  
        fs.unlinkSync(metadataPath);        
    }

    console.log("Deleting: " + videoPath);
    fs.unlinkSync(videoPath);
}  

/**
 * isConfigReady
 */
 const isConfigReady = (cfg: any) => {

    if (!cfg.get('storage-path')) {
        return false;
    }

    if (!cfg.get('log-path')) {
        return false;
    }

    const maxStorage = parseInt(cfg.get('max-storage'));

    if ((!maxStorage) && (maxStorage > 0)) { 
        return false;
    }

    const monitorIndex = parseInt(cfg.get('monitor-index'));

    if ((!monitorIndex) || (monitorIndex < 1) || (monitorIndex > 3)) {
        return false;
    }

    return true;
}  

/**
 * Open a folder in system explorer. 
 */
 const openSystemExplorer = (filePath: string) => {
    const windowsPath = filePath.replace(/\//g,"\\");
    let cmd = 'explorer.exe /select,"' + windowsPath + '"';
    exec(cmd, () => {});
}  

/**
 * Put a save marker on a video, protecting it from the file monitor.
 */
 const toggleVideoProtected = (videoPath: string) => {
    const metadataFile = getMetadataFileForVideo(videoPath);

    if (!fs.existsSync(metadataFile)) {
        console.log("WTF have you done to get here? (toggleVideoProtected)");
        return;
    }

    const metadataJSON = fs.readFileSync(metadataFile);
    const metadata = JSON.parse(metadataJSON);

    if (metadata.protected === undefined) {
        metadata.protected = true;
    } else {
        metadata.protected =  !Boolean(metadata.protected);
    }

    const newMetadataJsonString = JSON.stringify(metadata, null, 2);
    fs.writeFileSync(metadataFile, newMetadataJsonString);
}

/**
 * Takes an input MP4 file, trims the footage from the start of the video so
 * that the output is desiredDuration seconds. Some ugly async/await stuff 
 * here. Some interesting implementation details around ffmpeg in comments 
 * below. 
 * 
 * @param {string} initialFile path to initial MP4 file
 * @param {string} finalDir path to output directory
 * @param {number} desiredDuration seconds to cut down to
 */
const cutVideo = async (initialFile: string, finalDir: string, desiredDuration: number) => { 
    
    const videoFileName = path.basename(initialFile, '.mp4');
    const finalVideoPath = path.join(finalDir, videoFileName + ".mp4");

    return new Promise<void> ((resolve) => {

        // Use ffprobe to check the length of the initial file.
        ffmpeg.ffprobe(initialFile, (err: any, data: any) => {
            if (err) {
                console.log("FFprobe error: ", err);
                throw new Error("FFprobe error when cutting video");
            }

            // Calculate the desired start time relative to the initial file. 
            const bufferedDuration = data.format.duration;
            let startTime = Math.round(bufferedDuration - desiredDuration);

            // Defensively avoid a negative start time error case. 
            if (startTime < 0) {
                console.log("Video start time was: ", startTime);
                console.log("Avoiding error by not cutting video");
                startTime = 0;
            }

            // This was super helpful in debugging during development so I've kept it.
            console.log("Ready to cut video.");
            console.log("Initial duration:", bufferedDuration, 
                        "Desired duration:", desiredDuration,
                        "Calculated start time:", startTime);

            // It's crucial that we don't re-encode the video here as that 
            // would spin the CPU and delay the replay being available. I 
            // did try this with re-encoding as it has compression benefits 
            // but took literally ages. My CPU was maxed out for nearly the 
            // same elapsed time as the recording. 
            //
            // We ensure that we don't re-encode by passing the "-c copy" 
            // option to ffmpeg. Read about it here:
            // https://superuser.com/questions/377343/cut-part-from-video-file-from-start-position-to-end-position-with-ffmpeg
            //
            // This thread has a brilliant summary why we need "-avoid_negative_ts make_zero":
            // https://superuser.com/questions/1167958/video-cut-with-missing-frames-in-ffmpeg?rq=1
            ffmpeg(initialFile)
                .inputOptions([ `-ss ${startTime}`, `-t ${desiredDuration}` ])
                .outputOptions([ `-t ${desiredDuration}`, "-c:v copy", "-c:a copy", "-avoid_negative_ts make_zero" ])
                .output(finalVideoPath)

                // Handle the end of the FFmpeg cutting.
                .on('end', async (err: any) => {
                    if (err) {
                        console.log('FFmpeg video cut error (1): ', err)
                        throw new Error("FFmpeg error when cutting video (1)");
                    }
                    else {
                        console.log("FFmpeg cut video succeeded");
                        resolve();
                    }
                })

                // Handle an error with the FFmpeg cutting. Not sure if we 
                // need this as well as the above but being careful.
                .on('error', (err: any) => {
                    console.log('FFmpeg video cut error (2): ', err)
                    throw new Error("FFmpeg error when cutting video (2)");
                })
                .run()    
        })
    });
}

/**
 * Gets string value from the config in a more reliable manner.
 * @param cfg the config store
 * @param key the key
 * @returns the string config
 */
const getPathConfigSafe = (cfg: any, key: string): string => {
    return cfg.has(key) ? path.join(cfg.get(key), "/") : "";
}

/**
 * Gets number value from the config in a more reliable manner.
 * @param cfg the config store
 * @param preference the preference
 * @returns the number config
 */
 const getNumberConfigSafe = (cfg: any, preference: string): number => {
    return cfg.has(preference) ? parseInt(cfg.get(preference)) : NaN;
}

/**
 *  Default the monitor index to 1. 
 */
 const defaultMonitorIndex = (cfg: any): number => {
    console.info("Defaulting monitor index to 1");
    cfg.set('monitor-index', 1);
    return 1;
}

/**
 *  Add some escape characters to color text. Just return the string
 *  if production as don't want to litter real logs with this as it just
 *  looks messy.
 */
 const addColor = (s: string, color: string): string => {
    if (process.env.NODE_ENV === 'production') return s;

    if (color === "cyan") {
        return chalk.cyan(s);
    } else if (color === "green") {
        return chalk.green(s);
    } else {
        return s;
    }    
}

export {
    getVideoState,
    writeMetadataFile,
    runSizeMonitor, 
    isConfigReady,
    deleteVideo,
    openSystemExplorer,
    toggleVideoProtected,
    fixPathWhenPackaged,
    getNewestVideo,
    cutVideo,
    getPathConfigSafe,
    getNumberConfigSafe,
    defaultMonitorIndex, 
    addColor
};