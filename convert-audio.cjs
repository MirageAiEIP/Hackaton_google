#!/usr/bin/env node

/**
 * Script to convert audio files to WAV format for Google Speech-to-Text
 *
 * Usage: node convert-audio.cjs <input-file> [output-file]
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');

// Set ffmpeg binary path
ffmpeg.setFfmpegPath(ffmpegStatic);

async function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('🔄 Converting audio to WAV format...');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);

    ffmpeg(inputPath)
      .audioFrequency(16000)  // 16kHz sample rate (optimal for Speech-to-Text)
      .audioChannels(1)       // Mono
      .audioCodec('pcm_s16le') // LINEAR16 PCM
      .format('wav')
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`Progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log('✅ Conversion completed successfully!');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Conversion failed:', err.message);
        reject(err);
      })
      .save(outputPath);
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`
❌ Usage: node convert-audio.cjs <input-file> [output-file]

Example:
  node convert-audio.cjs test_audio/tel_test.m4a test_audio/tel_test.wav
    `);
    process.exit(1);
  }

  const inputPath = path.resolve(args[0]);

  // Generate output path if not provided
  let outputPath;
  if (args[1]) {
    outputPath = path.resolve(args[1]);
  } else {
    const parsed = path.parse(inputPath);
    outputPath = path.join(parsed.dir, `${parsed.name}.wav`);
  }

  try {
    await convertToWav(inputPath, outputPath);
    console.log('\n📁 Output file:', outputPath);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
