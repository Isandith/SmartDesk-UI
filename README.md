# SmartDesk AI Frontend

SmartDesk AI Frontend is an Angular chat interface for the Smart FAQ technical assessment.
It connects to the SmartDesk ASP.NET Core backend and provides a clean support-chat experience with sentiment and escalation visibility.

## Tech Stack

- Angular 19 (standalone components)
- TypeScript
- RxJS
- Angular HttpClient
- SCSS

## Core Features

- Chat interface for user and assistant messages
- Session-aware conversations with recent chat history
- Sentiment score display for each assistant response
- Escalation status display (true or false)
- Priority support banner when escalation is triggered
- Reset current session action
- Multiple local chat sessions with persistence in browser storage
- Graceful frontend error handling for API failures

## Frontend Architecture

The UI follows a component-based structure with clear separation of concerns:

- app component: state orchestration, API calls, message lifecycle
- chat sidebar: session list, create session, delete session
- chat header: active session title and reset action
- chat messages: message rendering, sentiment chips, escalation status
- chat composer: user input and send action
- chat service: backend API integration
- chat models: typed contracts for request and response payloads

## Project Structure

- src/app/components: visual UI components
- src/app/lib/interfaces: typed request and response models
- src/app/lib/services: API service layer
- src/environments: environment-specific backend URL configuration

## API Contract Used By Frontend

Ask endpoint request body:

- session_id: string (optional)
- message: string (required)

Ask endpoint response fields used by UI:

- session_id
- user_message
- answer
- sentiment_score
- priority_escalation
- response_source
- manual_mode
- context

Reset endpoint response fields used by UI:

- session_id
- cleared

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- SmartDesk backend running locally

## Setup Instructions

1. Install dependencies
	- npm install
2. Configure backend URL
	- Update src/environments/environment.ts if backend host or port is different
	- Update src/environments/environment.development.ts if needed
3. Start frontend
	- npm start
4. Open in browser
	- http://localhost:4200

## Available Scripts

- npm start: run Angular dev server
- npm run build: create production build
- npm run watch: build in watch mode
- npm test: run unit tests

## Behavior Notes

- Frontend expects backend sentiment_score to be in range -1.0 to 1.0
- Frontend displays escalation based on priority_escalation flag
- Frontend supports backend fallback/manual mode notices
- Sessions are saved in localStorage and restored on reload

## Troubleshooting

- If messages fail to send, verify backend is running and CORS allows frontend origin
- If sentiment or escalation is missing, check backend response payload fields
- If reset does not clear server session, verify reset endpoint connectivity

## Assessment Mapping

This frontend covers the UI requirements of the task:

- chat interface
- sentiment display
- escalation status display
- reset session control
- session-oriented chat workflow

Backend-specific requirements (AI strategy, adapter, fallback, validation, sentiment scoring) are handled in the SmartDesk API project.
