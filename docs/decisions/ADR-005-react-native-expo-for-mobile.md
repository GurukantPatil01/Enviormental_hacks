# ADR-005: React Native + Expo for Mobile Application

## Status
Accepted

## Context
EcoPulse requires a native mobile application running seamlessly on both Android and iOS devices, utilizing camera access for evidence capture, background geolocation for environmental trails, and offline queuing for rural or patchy connectivity areas. Building separate Swift and Kotlin codebases would double engineering overhead.

## Decision
We select **React Native** with **Expo SDK** and **Expo Router** using TypeScript.

## Consequences
- **Positive**: Single unified codebase for Android and iOS, access to native hardware modules via Expo APIs, file-based routing architecture matching modern best practices, rapid development cycle with Fast Refresh.
- **Negative**: Native build dependencies require proper Expo CLI tooling.
- **Mitigation**: Standard Expo managed workflow with prebuild capabilities for custom native modules when drone controller or low-level Bluetooth sensors are integrated in future phases.
