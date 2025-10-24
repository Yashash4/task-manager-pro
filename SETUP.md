# Task Manager Pro - Setup Guide

## Quick Start

### 1. Database Setup

1. Create a new Supabase project at https://supabase.com
2. Go to SQL Editor and run all scripts in this order:
   - \sql/schema.sql\ - Main tables and RLS policies
   - \sql/functions.sql\ - Helper functions and triggers
   - \sql/seed.sql\ - Optional test data (uncomment first)

### 2. Update Supabase Credentials

1. Go to Supabase Dashboard ? Project Settings ? API
2. Copy your Project URL and Anon Key
3. Update \public/assets/js/core/supabaseClient.js\:

\\\javascript
const SUPABASE_URL = "YOUR_PROJECT_URL";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
\\\

### 3. Deploy to Netlify

1. Push code to GitHub
2. Go to Netlify and connect your repository
3. Set Build command: (leave empty for static site)
4. Set Publish directory: \public\
5. Deploy!

## Project Structure

\\\
task-manager-pro/
+-- public/
¦   +-- index.html (Homepage)
¦   +-- auth/ (Login, Signup, Password Reset)
¦   +-- admin/ (Admin Dashboard, Users, Tasks, Rooms, Reports, Settings)
¦   +-- user/ (User Dashboard, Tasks, Notifications, Profile)
¦   +-- assets/
¦       +-- css/ (Styling)
¦       +-- js/
¦       ¦   +-- core/ (Supabase, Auth, Utils, Validation)
¦       ¦   +-- admin/ (Admin scripts)
¦       ¦   +-- user/ (User scripts)
¦       +-- icons/ (SVG icons)
+-- sql/
¦   +-- schema.sql (Database tables)
¦   +-- functions.sql (Triggers & functions)
¦   +-- seed.sql (Test data)
+-- .env.example
+-- README.md
+-- SETUP.md
\\\

## Features

### User Roles
- **Admin**: Create tasks, assign users, approve/reject submissions, manage rooms
- **User**: View assigned tasks, update status, submit for review
- **Approver**: Review and approve/reject task submissions
- **Creator**: Create and assign tasks only

### Task Lifecycle
1. Admin creates task
2. Admin assigns to user
3. User marks as "In Progress"
4. User submits for review
5. Admin approves or rejects
6. If approved: task complete
7. If rejected: user can rework

### Security Features
- Email verification
- Password strength validation
- Row-Level Security (RLS) on all tables
- Role-based access control
- Audit logging
- Room code rotation

## User Guide

### For Admins

1. **Create Organization**: Sign up as Admin
2. **Create Room Code**: Go to Rooms ? Create Room
3. **Invite Users**: Share room code with team members
4. **Approve Users**: Go to Users ? Approve pending users
5. **Assign Tasks**: Go to Tasks ? Create Task ? Assign to user
6. **Review Submissions**: Monitor task status and approve/reject

### For Users

1. **Join Team**: Sign up with organization code
2. **View Tasks**: Check your assigned tasks in "My Tasks"
3. **Start Work**: Click task ? "Start Working"
4. **Submit**: Click task ? "Submit for Review" when done
5. **Monitor**: Check notifications for approvals/rejections

## Troubleshooting

### "Supabase client not initialized"
- Check that Supabase URL and Anon Key are correct in \supabaseClient.js\

### "Failed to fetch user profile"
- Ensure \users_info\ table is created in Supabase
- Check that RLS policies are enabled

### "Login failed"
- Verify email is correct
- Check password requirements (8+ chars, uppercase, number, special char)

### "Room code invalid"
- Ensure room code is exactly 6 characters
- Code is case-sensitive (uppercase only)

## API Endpoints (via Supabase)

All data access goes through Supabase with RLS protection:

- \GET /rest/v1/rooms\ - Get rooms
- \POST /rest/v1/tasks\ - Create task
- \GET /rest/v1/tasks?assigned_to=...\ - Get user tasks
- \PATCH /rest/v1/tasks?id=...\ - Update task status

## Performance Tips

1. Use browser dev tools ? Network tab to monitor API calls
2. Check Supabase dashboard ? SQL Editor for query performance
3. Optimize RLS policies to reduce computation
4. Cache frequently accessed data in browser

## Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Submit pull request

## License

MIT License - Feel free to use for personal and commercial projects

## Support

For issues, email support@taskmanagerpro.com or create GitHub issue
