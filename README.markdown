# On-Call Management Telegram Bot

This is a Telegram bot designed to streamline on-call roster management, user role assignments, and critical incident notifications. Built with Node.js and integrated with Firebase Firestore, it supports shift-based scheduling, weekend-specific on-call checks, and a user-friendly interface for team coordination.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Commands](#commands)
- [Testing](#testing)
- [Loud Notifications](#loud-notifications)
- [Debugging](#debugging)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)

## Features
- **User Management**:
  - Register and manage users with roles: admin, lead, or user.
  - Assign admins, leads, and team members via Telegram commands.
  - View user roles, teams, and contact details.
- **Roster Management**:
  - Set rosters with specific dates, shift types (Morning, Afternoon, Night), and timings (1-12 AM/PM).
  - Display team rosters and today’s roster with primary/secondary contacts, phone numbers, Telegram deeplinks, and shift details.
- **On-Call Checks**:
  - `/oncall` command to view today’s roster, restricted to Saturdays and Sundays.
- **Critical Incident Handling**:
  - Report critical issues, notify the on-call team, and escalate if no response within 5 minutes.
  - Loud notifications for urgent alerts.
- **User Interface**:
  - `/commands`: Detailed command descriptions with examples.
  - `/help`: Concise command list.
  - Loading indicators for `/viewroster`, `/todayroster`, and `/oncall` for better UX.

## Prerequisites
Before setting up the bot, ensure you have:
- **Node.js**: Version 16 or higher.
- **Firebase Account**: With Firestore enabled for data storage.
- **Telegram Bot**: Created via `@BotFather` on Telegram.
- **npm**: For installing dependencies.

## Installation
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd on-call-bot
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   This installs required packages like `node-telegram-bot-api`, `firebase`, and `dotenv`.

## Configuration
1. **Environment Variables**:
   - Create a `.env` file in the `src/` directory:
     ```bash
     nano src/.env
     ```
   - Add the following:
     ```
     TELEGRAM_BOT_TOKEN=your_bot_token
     AUTHORIZED_TELEGRAM_ID=your_admin_telegram_id
     ```
     - **TELEGRAM_BOT_TOKEN**: Obtain from `@BotFather` after creating your bot.
     - **AUTHORIZED_TELEGRAM_ID**: Telegram ID of the designated admin (e.g., `123456789`).

2. **Firebase Setup**:
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).
   - Enable Firestore and note your project credentials.
   - Update `src/db.js` with your Firebase configuration (follow Firebase SDK setup instructions).
   - Set Firestore security rules to allow read/write for testing:
     ```json
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /{document=**} {
           allow read, write: if true;
         }
       }
     }
     ```

3. **Disable Telegram Privacy**:
   - In Telegram, go to `@BotFather`.
   - Send `/setprivacy` and select your bot.
   - Set to **Disabled** to allow the bot to read all messages.

## Commands
The bot supports the following commands, accessible via Telegram:

| Command | Description | Who Can Use | Example |
|---------|-------------|-------------|---------|
| `/start` | Initializes the bot, registers new users, or welcomes verified users with roles and team info. | Anyone | `/start` |
| `/setadmin` | Assigns a user as an admin (restricted to designated admin). | Designated Admin | `/setadmin 123456789 +918181922178 Suresh Admin` |
| `/setlead` | Assigns a user as a team lead. | Admins | `/setlead 111222333 +916392410389 Jane Doe linux` |
| `/adduser` | Adds a user to a team. | Admins, Leads | `/adduser 987654321 +919876543201 Ramesh linux` |
| `/getroles` | Displays roles, phone number, and team for a user. | Admins, Leads | `/getroles 123456789` |
| `/allroles` | Lists all team members with roles and contact details. | Admins, Leads | `/allroles @linux` |
| `/setroster` | Sets a roster with dates, shift type (Morning/Afternoon/Night), and timing (1-12 AM/PM). | Leads | `/setroster` (follow interactive prompts) |
| `/viewroster` | Displays all rosters for a team with shift details, names, and deeplinks. | Anyone | `/viewroster @linux` |
| `/todayroster` | Shows today’s roster with shift details. | Anyone | `/todayroster @linux` |
| `/oncall` | Displays today’s roster (only on Saturday/Sunday). | Anyone | `/oncall @linux` |
| `/critical` | Reports a critical incident, notifies the on-call team, and escalates if no response. | Anyone | `/critical @linux w16 down` |
| `/help` | Lists all commands with brief descriptions. | Anyone | `/help` |
| `/commands` | Provides detailed command descriptions with usage and examples. | Anyone | `/commands` |

**Notes**:
- Phone numbers must start with `+` (e.g., `+919876543210`).
- `/setroster` uses interactive keyboards for date, shift, and user selection.
- `/oncall` is restricted to weekends (Saturday and Sunday).

## Testing
### Test Accounts
- **Account 1**: `+918181922178` (Admin, Telegram ID: `123456789`)
- **Account 2**: `+916392410389` (Lead, Telegram ID: `111222333`)

### Test Flow (Linux Team)
1. **Setup**:
   - Run `/start` on both accounts to get Telegram IDs.
   - Update `.env` with `AUTHORIZED_TELEGRAM_ID=123456789`.
   - Restart bot:
     ```bash
     pkill node
     node src/bot.js
     ```

2. **User Management**:
   - Account 1:
     - `/setadmin 123456789 +918181922178 Suresh Admin`
     - `/setlead 111222333 +916392410389 Jane Doe linux`
     - `/adduser 111222333 +916392410389 Jane Doe linux`
     - `/getroles