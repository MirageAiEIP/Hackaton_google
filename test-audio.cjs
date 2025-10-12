#!/usr/bin/env node

/**
 * Script de test pour l'analyse de sentiment avec audio
 *
 * Usage: node test-audio.cjs <path-to-audio-file> [transcript]
 *
 * Exemple:
 *   node test-audio.cjs ./my-audio.wav "Bonjour j'ai très mal"
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const API_BASE = 'http://localhost:3000/api/v1/sentiment';

async function uploadAudio(audioPath, callId) {
  console.log('\n📤 Uploading audio file...');
  console.log('File:', audioPath);
  console.log('Call ID:', callId);

  // Use curl for reliable multipart upload
  const curlCommand = `curl -X POST ${API_BASE}/upload-audio -F "callId=${callId}" -F "audio=@${audioPath}" -s`;

  try {
    const { stdout, stderr } = await execAsync(curlCommand);

    if (stderr) {
      throw new Error(`Upload failed: ${stderr}`);
    }

    const result = JSON.parse(stdout);

    if (!result.success) {
      throw new Error(`Upload failed: ${JSON.stringify(result.error)}`);
    }

    console.log('✅ Upload successful!');
    console.log('Audio URL:', result.data.audioUrl);

    return result.data.audioUrl;
  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

async function analyzeWithAudio(callId, transcript, audioUrl) {
  console.log('\n🧠 Analyzing sentiment (text + audio)...');
  console.log('Transcript:', transcript);
  console.log('Audio URL:', audioUrl);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callId,
      transcript,
      audioUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }

  const result = await response.json();
  console.log('\n✅ Analysis complete!');
  console.log('\n📊 Results:');
  console.log('─────────────────────────────────────────');
  console.log('Text Score:          ', result.data.textScore);
  console.log('Audio Score:         ', result.data.audioScore);
  console.log('Final Score:         ', result.data.finalScore);
  console.log('Coherence:           ', result.data.coherence);
  console.log('Recommendation:      ', result.data.recommendation);
  console.log('Points Adjustment:   ', result.data.pointsAdjustment);
  console.log('Confidence:          ', result.data.confidence);
  console.log('─────────────────────────────────────────');
  console.log('\n💬 Reasoning:');
  console.log(result.data.reasoning);
  console.log('\n');

  return result.data;
}

async function analyzeTextOnly(callId, transcript) {
  console.log('\n🧠 Analyzing sentiment (text only)...');
  console.log('Transcript:', transcript);

  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      callId,
      transcript,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Analysis failed: ${error}`);
  }

  const result = await response.json();
  console.log('\n✅ Analysis complete!');
  console.log('\n📊 Results (text only):');
  console.log('─────────────────────────────────────────');
  console.log('Text Score:          ', result.data.textScore);
  console.log('Final Score:         ', result.data.finalScore);
  console.log('Recommendation:      ', result.data.recommendation);
  console.log('Points Adjustment:   ', result.data.pointsAdjustment);
  console.log('Confidence:          ', result.data.confidence);
  console.log('─────────────────────────────────────────');
  console.log('\n💬 Reasoning:');
  console.log(result.data.reasoning);
  console.log('\n');

  return result.data;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`
❌ Usage: node test-audio.cjs <audio-file-path> [transcript]

Examples:
  # With audio + transcript
  node test-audio.cjs ./audio.wav "Bonjour j'ai très mal à la poitrine"

  # Text only (no audio)
  node test-audio.cjs --text-only "Bonjour j'ai très mal à la poitrine"
    `);
    process.exit(1);
  }

  try {
    // Check if text-only mode
    if (args[0] === '--text-only') {
      const transcript = args[1];
      if (!transcript) {
        console.error('❌ Please provide a transcript for text-only mode');
        process.exit(1);
      }

      const callId = `test-text-${Date.now()}`;
      await analyzeTextOnly(callId, transcript);
      return;
    }

    // Audio + text mode
    const audioPath = path.resolve(args[0]);
    const transcript = args[1] || 'Analyse automatique';

    // Check if file exists
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ File not found: ${audioPath}`);
      process.exit(1);
    }

    // Check file size
    const stats = fs.statSync(audioPath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log('📁 File size:', fileSizeMB.toFixed(2), 'MB');

    if (fileSizeMB > 50) {
      console.error('❌ File too large (max 50MB)');
      process.exit(1);
    }

    // Generate call ID
    const callId = `test-${Date.now()}`;

    // Upload audio
    const audioUrl = await uploadAudio(audioPath, callId);

    // Wait a bit for Google to process
    console.log('\n⏳ Waiting 2 seconds for processing...');
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Analyze
    await analyzeWithAudio(callId, transcript, audioUrl);

    console.log('✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
