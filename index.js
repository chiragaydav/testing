const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);

const app = express();
const port = 3000;
const downloadsFolder = path.join(__dirname, 'downloads');

if (!fs.existsSync(downloadsFolder)) {
  fs.mkdirSync(downloadsFolder);
}

app.use(cors({ origin: 'https://youtubetomp3hub.com' }));
app.use(bodyParser.json());

const videoTitles = {};
const videoFiles = {};

app.post('/fetch_info', async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) {
    return res.status(400).json({ error: 'No video ID provided.' });
  }
  try {
    const info = await ytdl.getInfo(video_id);
    const title = info.videoDetails.title;
    const normalizedTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    videoTitles[video_id] = `${normalizedTitle}.mp3`;

    const downloadLink = `http://localhost:${port}/download_mp3?video_id=${video_id}`;

    const audioInfo = {
      title: title,
      thumbnail_url: info.videoDetails.thumbnails[0].url,
      downloadLink: downloadLink
    };

    res.json(audioInfo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching video info.' });
  }
});

app.get('/download_mp3', async (req, res) => {
  const { video_id } = req.query;
  if (!video_id) {
    return res.status(400).send('No video ID provided.');
  }
  
  const title = videoTitles[video_id] || 'default_title';
  const filepath = path.join(downloadsFolder, `${title}.mp3`);

  if (videoFiles[video_id]) {
    return serveFile(req, res, filepath);
  }

  try {
    const stream = ytdl(video_id, { quality: 'highestaudio' });
    const tempPath = filepath + '.tmp';

    await pipeline(
      stream,
      ffmpeg().audioCodec('libmp3lame').toFormat('mp3'),
      fs.createWriteStream(tempPath)
    );

    fs.renameSync(tempPath, filepath);
    videoFiles[video_id] = filepath;

    serveFile(req, res, filepath);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error converting or serving video to MP3.');
  }
});

function serveFile(req, res, filepath) {
  fs.stat(filepath, (err, stats) => {
    if (err) {
      return res.status(404).send('File not found.');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filepath)}"`);
    
    const readStream = fs.createReadStream(filepath);
    readStream.pipe(res);
  });
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
