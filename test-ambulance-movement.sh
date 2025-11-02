#!/bin/bash

# Test script for ambulance movement simulation
# This script demonstrates the real-time ambulance tracking feature

echo "=========================================="
echo "Ambulance Movement Simulator Test"
echo "=========================================="
echo ""

API_URL="http://localhost:8080/api/v1"

echo "1. Getting available ambulances..."
curl -s "${API_URL}/map/ambulances" | jq '.ambulances[] | {id, callSign, status, location}'

echo ""
echo ""
echo "2. Starting ambulance movement simulation..."
echo "   - Duration: 60 seconds"
echo "   - Update interval: 2 seconds (location updates every 2 seconds)"
echo ""

# Start simulation
RESPONSE=$(curl -s -X POST "${API_URL}/simulator/simulate-movement" \
  -H "Content-Type: application/json" \
  -d '{
    "duration": 60,
    "updateInterval": 2000
  }')

echo "$RESPONSE" | jq '.'

AMBULANCE_ID=$(echo "$RESPONSE" | jq -r '.ambulanceId')

echo ""
echo "=========================================="
echo "Simulation Started!"
echo "=========================================="
echo ""
echo "Ambulance ID: $AMBULANCE_ID"
echo ""
echo "The ambulance will now move around Paris for 60 seconds."
echo "You should see the ambulance moving in real-time on the map!"
echo ""
echo "What's happening:"
echo "  - Every 2 seconds, the backend publishes a location update"
echo "  - The WebSocket broadcasts this to all connected map viewers"
echo "  - The frontend receives the update and smoothly animates the marker"
echo ""
echo "To view the movement:"
echo "  1. Open your browser to the dashboard: http://localhost:3000/dashboard"
echo "  2. Scroll down to the 'Live Emergency Map' section"
echo "  3. Watch the ambulance marker move smoothly across the map!"
echo ""
echo "To stop all simulations early:"
echo "  curl -X POST ${API_URL}/simulator/stop-simulations"
echo ""
