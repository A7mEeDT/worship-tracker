# Text File Storage

Runtime data is written here:

- `users.txt` - regular users, one per line: `username:hashed_password`
- `admin_credentials.txt` - admin + primary admin credentials, one per line: `username:hashed_password`
- `primary_admins.txt` - primary admin usernames, one per line
- `deactivated_users.txt` - deactivated usernames, one per line
- `wird_config.txt` - global wird configuration, one per line: `name|type|points`
- `worship_reports.txt` - one JSON report per line with owner username and day report payload
- `question_groups.txt` - one JSON question group per line (includes correct answers; admins only)
- `question_sessions.txt` - one JSON session line per user per active group (used to compute time spent)
- `question_submissions.txt` - one JSON submission per line (includes answers + scoring details)
- `user_activity_log.txt` - activity entries: `YYYY-MM-DD HH:mm:ss, username, action, ip`
- `admin_notifications.txt` - notification entries: `YYYY-MM-DD HH:mm:ss, username, action, admin_username`
