#!/bin/bash

echo "🚨 Testing SMUR Dispatch..."
echo ""

# Test dispatch to Eiffel Tower area
curl -X POST http://localhost:8080/api/v1/tools/dispatch_smur \
  -H "Content-Type: application/json" \
  -d '{
    "priority": "P0",
    "location": "Champ de Mars, 75007 Paris (Tour Eiffel)",
    "symptoms": "Cardiac arrest - patient unconscious, no pulse",
    "latitude": 48.8584,
    "longitude": 2.2945
  }'

echo ""
echo ""
echo "✅ Dispatch sent! Check the map at http://localhost:8080/map.html"
echo "🚑 Watch the nearest ambulance start moving to the Eiffel Tower!"
