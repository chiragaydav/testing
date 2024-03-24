const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Update CORS Configuration to allow requests from all origins
app.use(cors());

app.use(bodyParser.json());

const audioTitles = {};

app.post('/fetch_info', async (req, res) => {
  const { video_id } = req.body;
  if (!video_id) {
    return res.status(400).json({ error: 'No video ID provided.' });
  }

  try {
    const info = await ytdl.getInfo(video_id);
    const title = info.videoDetails.title;
    const normalizedTitle = title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_");
    audioTitles[video_id] = `${normalizedTitle}.mp3`;

    const downloadLink = `${req.protocol}://${req.get('host')}/download_mp3?video_id=${video_id}`;
    const fileSize = info.formats.find(format => format.hasAudio && format.audioBitrate).contentLength;

    const audioInfo = {
      title: title,
      thumbnail_url: info.videoDetails.thumbnails[0].url,
      downloadLink: downloadLink,
      fileSize: fileSize
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
  
    const title = audioTitles[video_id] || 'default_title.mp3';
  
    try {
      const info = await ytdl.getInfo(video_id);
      const format = ytdl.chooseFormat(info.formats, { filter: 'audioonly', quality: 'highestaudio' });
  
      if (!format) {
        return res.status(404).send('No suitable format found.');
      }
  
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${title}"`);
      res.setHeader('Content-Length', format.contentLength); // Set correct content length
  
      const stream = ytdl(video_id, { format });
      
      // Pipe the stream directly to response
      stream.pipe(res);
  
      stream.on('error', error => {
        console.error(error);
        res.status(500).send('Error streaming the audio.');
      });
      
    } catch (error) {
      console.error(error);
      res.status(500).send('Error fetching video info.');
    }
  });
  
app.listen(port, '0.0.0.0', () => { // Listen on all network interfaces
  console.log(`Server running on port ${port}`);
});
