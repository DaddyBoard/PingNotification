# PingNotification

![GitHub stars](https://img.shields.io/github/stars/DaddyBoard/PingNotification?style=social)
![GitHub forks](https://img.shields.io/github/forks/DaddyBoard/PingNotification?style=social)
![GitHub issues](https://img.shields.io/github/issues/DaddyBoard/PingNotification)

A lightweight BetterDiscord plugin to display in-app notifications that focuses on simplicity and efficiency.

## 🚀 Features

- In-app notifications for mentions, DMs, and in-line replies
- Customizable server-specific notifications
- User and channel blocking capabilities
- Privacy mode for content protection

## 🔧 Default Operation

Out of the box, PingNotification will be in "Automatic" mode which will alert for all messages that you physically here a ping for (aka it follows your discord-level notification settings per guild/channel/user.) 

You have the option to swap to "Manual" mode where you can configure which servers/channels you want to ping for, in manual mode:
- Mentions
- Direct Messages (DMs)
- In-line Replies (same as mention)

## ⚙️ Configuration

Navigate to `BetterDiscord > Plugins > PingNotification settings` to:
- Allow specific servers to notify **all** messages
- Block individual User IDs
- Block specific channels

## 📦 Latest Updates

<details open>
<summary><strong>v6.2</strong></summary>

- Added context menu items for channels, guilds, threads and users for easy addition/removal from ignored lists
- Completely rewritten settings menus with a new design
- Overhauled popup theme for a more sleek and modern look with better readability
- Completely removed the blacklist/whitelist system. Default behavior is now:
  - **Whitelist** servers you want all notifications for
  - **Ignore** specific channels
  - **Ignore** specific users
  
**Note:** If you experience issues, fully close Discord and delete 'pingnotification.**config**.json' from your BetterDiscord/plugins folder. Restart Discord to reset the plugin to default settings. You'll need to reconfigure your preferences.
</details>

<details>
<summary><strong>v6.1</strong></summary>

- Added logic to handle forwarded messages gracefully.
</details>

<details>
<summary><strong>v6.0</strong></summary>

- **Major change:** Moved away from ZeresPluginLibrary to use built-in BdApi.
- General code improvements and optimizations.
</details>

<details>
<summary><strong>v5.4.1</strong></summary>

- You can now swipe the notification to the left or right to close it, depending on notification location.
- Added a new setting to show nicknames instead of usernames from the server the message was sent in. *Disabled by default.*
- Added a new setting to show senders color based on their role from the server the message was sent in. *Disabled by default.*
- General code improvements and optimizations.
</details>

<details>
<summary><strong>v5.3</strong></summary>

- Enhanced settings panel for improved user experience
- Added count indicators for selected channels and guilds
- Introduced privacy mode to blur notification content until hover
  
![v5.3 Demo](https://i.imgur.com/Y69pIG0.gif)
</details>

## 🐛 Known Issues

- Stickers do not display in the notification window.

If you encounter any problems, please [open an issue](https://github.com/DaddyBoard/PingNotification/issues).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/DaddyBoard/PingNotification/issues).

## 🌟 Show your support

Give a ⭐️ if this project helped you!
