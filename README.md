# 🧠 SlotBot : an AI-Powered Scheduling Bot with Nylas & Gemini

An intelligent scheduling assistant built using **React**, **Express/Node**, **MongoDB**, and powered by **Nylas API** and **Gemini AI**.
This bot streamlines the interview scheduling process by analyzing recruiter availability, candidate preferences, and existing calendar events
to automatically find the best meeting slots and create Google Calendar events with virtual meeting links.

---

## 🚀 Live Demo

Hosted URL: https://slotbot-client.vercel.app/

---

## 📦 Repositories

> This project consists of two repositories:

-  **Frontend Repo** – https://github.com/sethu-ravichandran/slotbot-client

-  **Backend Repo** – https://github.com/sethu-ravichandran/slotbot-server

---

## 📸 Demo Walkthrough

Watch the full [demo video](https://youtu.be/oH6zu4ncZdU?si=8AhY6XfmVXX5ldHt) of the working app in action.

---

## 🛠️ Tech Stack

| Layer         | Technology                            |
|---------------|----------------------------------------|
| Frontend      | React (JSX), Tailwind CSS              |
| Backend       | Express.js, Node.js                    |
| Database      | MongoDB (Atlas)                        |
| Calendar API  | Nylas SDK (Google Calendar Integration)|
| AI Scheduling | Gemini AI API (Prompt-based Scheduling)|
| Hosting       | Vercel (Frontend & Backend)            |

---

## ✨ Features

- 🔐 **OAuth Authentication** with Google Calendar via Nylas
- 📆 **Calendar Sync**: Fetch and display Google Calendar events
- ⏳ **Smart Slot Selection**: Candidates can choose up to 5 time slots
- 🤝 **AI-Powered Scheduling** using Gemini AI to find optimal meeting times
- 📤 **Automatic Event Creation**: Creates Google Meet links and sends invites
- 📊 **Dashboards** for Recruiters and Candidates
- ⛔ **Weekend & Past-Date Blocking**
- 🔁 **Dynamic UI**: Displays upcoming & past interviews, availability, and more
- 🛡️ **Validation**: Prevents time overlaps, handles edge cases gracefully

