# WorkPilot AI — AI-Powered Workforce & Project Management

WorkPilot AI is a modern SaaS platform designed to optimize project management, automate repetitive workflows, and track employee productivity. This repository contains the complete frontend architecture, featuring role-based dashboards, Kanban task tracking, and specialized UI components for AI-driven schedule recovery and automation advisement.

## 🚀 Key Features

**Manager / Admin Tools:**
-   **AI Recovery Planner:** Simulates risk analysis and generates structured, prioritized recovery plans for delayed projects with an "Approval Gate" system.
-   **Automation Advisor:** Evaluates team workflows and estimates time savings for n8n/Python automations.
-   **Impact-Aware Leave Approvals:** Previews how an employee's time off will impact project capacity and delayed tasks before approval.
-   **Dynamic Task Board:** Toggles seamlessly between List and Kanban views.

**Employee Tools:**
-   **Focus Guardian:** A non-punitive, accessible modal that tracks task deviations to improve project forecasting.
-   **Daily Work Logs:** Tracks estimated versus recorded effort.
-   **Leave Management:** Seamless request forms with real-time status tracking.

## 💻 Tech Stack
-   **Frontend Framework:** React.js (Vite)
-   **Routing:** React Router DOM (Role-based Protected Routes)
-   **Styling:** Tailwind CSS v3
-   **State Management:** React Context API (AuthContext, ToastContext)
-   **API Layer:** Axios (Configured with interceptors and mock service layers for backend handoff)

## 📂 Folder Structure
```text
frontend/
├── src/
│   ├── assets/       # Static images and icons
│   ├── components/   # Reusable UI elements (buttons, modals, cards)
│   ├── context/      # Global state (Auth, Toast notifications)
│   ├── layouts/      # MainLayout with role-based sidebar
│   ├── pages/        # Main route components (Dashboards, Recovery Planner, etc.)
│   └── services/     # Axios API instances and mock data services
├── .env              # Environment variables (API Base URL)
├── package.json      # Dependencies and scripts
└── vite.config.js    # Vite configuration 

🛠️ Setup Instructions
1. Clone the repository:

git clone https://github.com/your-username/workpilot-ai.git
cd workpilot-ai

2. Install dependencies:

npm install

3. Configure environment variables:

VITE_API_BASE_URL=http://localhost:8000/api/v1

4. Run the development server:

npm run dev

🔌 Backend API Contracts (Handoff Guide)

AI Recovery Planner
GET /projects/{id}/recovery-plan

JSON
{
  "risk_level": "High",
  "reasoning_summary": "A developer being on leave has caused critical delays.",
  "recommended_actions": [
    { "action": "Reassign Task: Fix Auth Bug", "priority": "High" },
    { "action": "Defer non-essential CSS updates", "priority": "Medium" }
  ],
  "requires_manager_approval": true
}

Automation Advisor
GET /ai/automations

JSON
[
  { 
    "id": "auto-1", 
    "tool": "n8n", 
    "activity": "Automated Backup Verification", 
    "complexity": "Low", 
    "timeSavings": "4 hours/week", 
    "status": "pending" 
  }
]

Leave Management Impact
GET /leave-requests

JSON
[
  {
    "id": "LR-101",
    "employeeName": "Alex Chen",
    "startDate": "2026-11-01",
    "endDate": "2026-11-05",
    "status": "Pending",
    "impact": "Delays API Migration by 3 days"
  }
]