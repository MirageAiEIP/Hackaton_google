#!/usr/bin/env node
/**
 * Quick test of the new @google/genai SDK
 */

import { GoogleGenAI } from '@google/genai';

const apiKey = 'AIzaSyCK75-k_Qp8ICLL7LjUsQpWb8foIjlTR9s';

async function testNewSDK() {
  console.log('Testing new @google/genai SDK...\n');

  try {
    const ai = new GoogleGenAI({ apiKey });

    console.log('Calling generateContent...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: 'Say "Hello World" in French',
    });

    console.log('Response received!');
    console.log('Text:', response.text);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testNewSDK();
