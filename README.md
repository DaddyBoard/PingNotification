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

Out of the box, PingNotification will be in "Automatic" mode which will alert for all messages that you physically hear a ping for (aka it follows your discord-level notification settings per guild/channel/user.) 

## ⚙️ Configuration

Navigate to `BetterDiscord > Plugins > PingNotification settings` to:
- Customise coloring of user mentions, role mentions and more.
- Customise length of notification shown on screen
- Change display location of the notification window
- Enable 'Privacy Mode' which hides all message content and attachments behind a `hover-to-reveal` system
- Configure the ability to apply 'Privacy Mode' to NSFW channels
And much more!

## 📦 Latest Updates

<details open>
<summary><strong>v7.0.0 - 7.0.2</strong></summary>
- Fully rewritten (again) to use MessageAccessories, this allows for near-native rendering of various message components, like embeds, attachments, and more.
- Now shows in-line reply context (ReferencedMessage)
- Now supports updating messages (embeds changing, users editing messages)
- Now also supports tracking reactions to messages!
- So much more, can't even remember all the stuff I've added!
- Fixed accidental breakage of mentions, inline replies, role mentions, @everyone, and @here. Sorry about that!
- Replaced a few old/unsupported methods with ones that are supported - this is needed for approval. Thanks @domi.btnr
</details>

<details>
<summary><strong>v6.3, 6.3.1, 6.3.2</strong></summary>

- Added proper support for spoilered content (text, images and videos) in notifications
- Privacy mode rework, is now clearer and more intuitive
- Now displays Group DMs as 'Group Chat • {Name}'
- Added support for threads in automatic mode
- Now closes all notifications from the same channel/DM when one is clicked
- Added new setting to color user mentions based on their role color
- Added new 'automatic' mode that follows Discord's notification settings directly
- Added new setting to blur all content from NSFW (age restricted) channels, disabled by default
- Updated changelog to use BetterDiscord's UI components
- Fixed issue with un-spoilered images not being clickable to invoke transitionTo
- Fixed role name retrieval for role mentions
- Fixed issue with role color not being applied to mentions
- Disabled image draggable property to prevent choppy swipe animation
- Various other optimizations and fixes. Reduced API calls by roughly 50%. First version of this plugin was very bad at calling the same API multiple times, and with more development over time it was calling the same API multiple times for every single notification
 
**Note:** If you experience issues, fully close Discord and delete 'pingnotification.**config**.json' from your BetterDiscord/plugins folder. Restart Discord to reset the plugin to default settings. You'll need to reconfigure your preferences.
</details>

<details>
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
