# Text File Storage

Runtime data is written here:

- `users.txt` - regular users, one per line: `username:hashed_password`
- `admin_credentials.txt` - admin + primary admin credentials, one per line: `username:hashed_password`
- `primary_admins.txt` - primary admin usernames, one per line
- `deactivated_users.txt` - deactivated usernames, one per line
- `wird_config.txt` - global wird configuration, one per line: `name|type|points`
- `worship_reports.txt` - one JSON report per line with owner username and day report payload
- `user_activity_log.txt` - activity entries: `YYYY-MM-DD HH:mm:ss, username, action, ip`
- `admin_notifications.txt` - notification entries: `YYYY-MM-DD HH:mm:ss, username, action, admin_username`
