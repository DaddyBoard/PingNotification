/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 6.0
 * @description A BetterDiscord plugin to show in-app notifications for mentions, DMs, and messages in specific guilds.
 * @website https://github.com/DaddyBoard/PingNotification
 * @source https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js
 */

const { React, Webpack, Patcher, Data, Dispatcher, ReactDOM } = BdApi;


const UserStore = Webpack.getStore("UserStore");
const ChannelStore = Webpack.getStore("ChannelStore");
const GuildStore = Webpack.getStore("GuildStore");
const SelectedChannelStore = Webpack.getStore("SelectedChannelStore");
const RelationshipStore = Webpack.getStore("RelationshipStore");
const GuildChannelStore = Webpack.getStore("GuildChannelStore");
const transitionTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{searchExports:true});
const MessageParserModule = Webpack.getModule(m => m.defaultRules && m.parse);
const parse = MessageParserModule?.parse;
const GuildMemberStore = Webpack.getModule(m => m.getMember);
const ColorConverter = Webpack.getModule(m => m.int2hex);

module.exports = class PingNotification {


    async checkForUpdates() {
        try {
            const response = await fetch(this.config.info.github_raw);
            if (response.ok) {
                const remoteContent = await response.text();
                const remoteVersion = this.getVersionFromMeta(remoteContent);
                if (remoteVersion) {
                    const hasUpdate = this.versionCompare(this.config.info.version, remoteVersion) < 0;
                    console.log(`PingNotification: Remote version: ${remoteVersion}, Current version: ${this.config.info.version}, Has update: ${hasUpdate}`);

                    if (hasUpdate) {
                        this.updateNotice = BdApi.UI.showNotice(`An update is available for ${this.config.info.name} (${remoteVersion}).`, {
                            type: "info",
                            buttons: [{
                                label: "Update Now",
                                onClick: () => this.updatePlugin(remoteContent)
                            }],
                            timeout: 0
                        });
                    }
                } else {
                    console.log("PingNotification: Unable to parse remote version.");
                }
            } else {
                console.log(`PingNotification: Failed to fetch update. Status: ${response.status}`);
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
        }
    }

    getVersionFromMeta(fileContent) {
        const versionMatch = fileContent.match(/@version\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
        return versionMatch ? versionMatch[1] : null;
    }

    versionCompare(v1, v2) {
        if (!v1 || !v2) return 0;
        const v1parts = v1.split('.').map(Number);
        const v2parts = v2.split('.').map(Number);

        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); ++i) {
            if (v1parts[i] === undefined) return -1;
            if (v2parts[i] === undefined) return 1;
            if (v1parts[i] > v2parts[i]) return 1;
            if (v1parts[i] < v2parts[i]) return -1;
        }

        return 0;
    }

    async updatePlugin(remoteContent) {
        try {
            const fs = require('fs');
            const path = require('path');
            const pluginPath = path.join(BdApi.Plugins.folder, `${this.config.info.name}.plugin.js`);

            fs.writeFileSync(pluginPath, remoteContent);

            if (this.updateNotice) {
                this.updateNotice();
                this.updateNotice = null;
            }

            BdApi.UI.showToast(`${this.config.info.name} updated successfully.`, {type: "success"});

        } catch (error) {
            console.error("Failed to update plugin:", error);
            BdApi.UI.showToast(`Failed to update ${this.config.info.name}.`, {type: "error"});
        }
    }

    showChangelog() {
        try {
            const ChangelogContent = () => {
                const parseMarkdown = (text) => {
                    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                               .replace(/^\* (.+)$/gm, '• $1')
                               .replace(/\*(.*?)\*/g, '<em>$1</em>')
                               .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                               .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                               .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                               .replace(/\n/g, '<br>');
                };

                return React.createElement('div', { style: { color: 'var(--text-normal)', padding: '20px' } },
                    Array.isArray(this.config.changelog) ? this.config.changelog.map((change, index) => 
                        React.createElement('div', { key: index, style: { marginBottom: '20px' } },
                            React.createElement('h3', { 
                                style: { 
                                    color: 'var(--header-secondary)', 
                                    marginBottom: '10px',
                                    paddingLeft: '0px'
                                } 
                            }, change.title),
                            React.createElement('div', { 
                                style: { 
                                    paddingLeft: '20px'
                                } 
                            },
                                change.items.map((item, itemIndex) => 
                                    React.createElement('div', { 
                                        key: itemIndex,
                                        style: { marginBottom: '10px' },
                                        dangerouslySetInnerHTML: { __html: parseMarkdown(item) }
                                    })
                                )
                            )
                        )
                    ) : React.createElement('p', null, "No changelog available.")
                );
            };

            BdApi.showConfirmationModal(
                "PingNotification Changelog",
                React.createElement(ChangelogContent),
                {
                    confirmText: "Close",
                    cancelText: null,
                    onConfirm: () => {}
                }
            );

            console.log("PingNotification: Changelog modal shown");
        } catch (error) {
            console.error("PingNotification: Error showing changelog", error);
        }
    }

    constructor() {
        this.config = {
            info: {
                name: "PingNotification",
                authors: [
                    {
                        name: "DaddyBoard",
                        discord_id: "241334335884492810",
                        github_username: "DaddyBoard",
                    }
                ],
                version: "6.0",
                description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with React components.",
                github: "https://github.com/DaddyBoard/PingNotification",
                github_raw: "https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js"
            },
            changelog: [
                {
                    title: "What's New in v6.0",
                    items: [
                        "* **Major change:** Moved away from ZeresPluginLibrary to use built-in BdApi.",
                        "* General code improvements and optimizations."
                    ]
                },
                {
                    title: "New in v5.4.1",
                    items: [
                        "* You can now swipe the notification to the left or right to close it, depending on notification location.",
                        "* Added a new setting to show nicknames instead of usernames from the server the message was sent in. *Disabled by default.*",
                        "* Added a new setting to show senders color based on their role from the server the message was sent in. *Disabled by default.*",
                        "* General code improvements and optimizations."
                    ]
                },
                {
                    title: "Known Issues",
                    items: [
                        "Mentions of your username will be the role color of the server you're currently in, not the server the message was sent in. *(help wanted: I'm not sure how to fix this one)*"
                    ]
                }
            ],
            main: "index.js"
        };


        this.defaultSettings = {
                duration: 15000,
                ignoredUsers: [],
                ignoredChannels: [],
                allowedGuilds: {},
                popupLocation: "bottomRight",
                isBlacklistMode: true,
                allowNotificationsInCurrentChannel: false,
                privacyMode: false,
                coloredUsernames: true,
                showNicknames: false
            };
            this.activeNotifications = [];
            this.updateNotice = null;
        }

        getName() { return this.config.info.name; }
        getAuthor() { return this.config.info.authors.map(a => a.name).join(", "); }
        getDescription() { return this.config.info.description; }
        getVersion() { return this.config.info.version; }

        start() {
            this.loadSettings();
            this.patchDispatcher();
            BdApi.injectCSS("PingNotificationStyles", this.css);
            
            const lastVersion = BdApi.getData("PingNotification", "lastVersion");
            const currentVersion = this.getVersion();
            
            console.log(`PingNotification: Last version: ${lastVersion}, Current version: ${currentVersion}`);
            
            if (lastVersion !== currentVersion) {
                console.log("PingNotification: Showing changelog");
                this.showChangelog();
                BdApi.setData("PingNotification", "lastVersion", currentVersion);
            }
            
            console.log("PingNotification started");
            this.checkForUpdates();
        }

        stop() {
            BdApi.Patcher.unpatchAll("PingNotification");
            this.removeAllNotifications();
            BdApi.clearCSS("PingNotificationStyles");
            console.log("PingNotification stopped");

            if (this.updateNotice) {
                this.updateNotice();
                this.updateNotice = null;
            }
        }

        loadSettings() {
            this.settings = { ...this.defaultSettings, ...BdApi.Data.load("PingNotification", "settings") };
            console.log("Settings loaded:", this.settings);
        }

        saveSettings() {
            BdApi.Data.save("PingNotification", "settings", this.settings);
            console.log("Settings saved:", this.settings);
        }

        patchDispatcher() {
            BdApi.Patcher.after("PingNotification", BdApi.findModuleByProps("dispatch"), "dispatch", (_, [event]) => {
                if (event.type === "MESSAGE_CREATE") {
                    this.onMessageReceived(event.message);
                }
            });
        }

        onMessageReceived(message) {
            const channel = ChannelStore.getChannel(message.channel_id);
            const currentUser = UserStore.getCurrentUser();

            if (!channel || message.author.id === currentUser.id) return;

            if (this.shouldNotify(message, channel)) {
                console.log("Showing notification for message:", message);
                this.showNotification(message, channel);
            }
        }

        shouldNotify(message, channel) {
            const currentUser = UserStore.getCurrentUser();
            
            if (!this.settings.allowNotificationsInCurrentChannel && channel.id === SelectedChannelStore.getChannelId()) {
                return false;
            }

            if (message.flags && (message.flags & 64) === 64) {
                return false;
            }

            const isMention = message.mentions.some(mention => mention.id === currentUser.id) || message.mention_everyone;
            const isUserIgnored = this.settings.ignoredUsers.includes(message.author.id);
            const isChannelIgnored = this.settings.ignoredChannels.includes(channel.id);
            const isGuildAllowed = this.settings.allowedGuilds[channel.guild_id] || false;

            if (message.mention_roles.length > 0) {
                const guildMember = GuildMemberStore.getMember(channel.guild_id, currentUser.id);
                if (guildMember && guildMember.roles) {
                    const isRoleMentioned = message.mention_roles.some(roleId => guildMember.roles.includes(roleId));
                    if (isRoleMentioned) return true;
                }
            }

            if (!channel.guild_id) return !isUserIgnored;

            if (this.settings.isBlacklistMode) {
                return (isMention || isGuildAllowed) && !isUserIgnored && !isChannelIgnored;
            } else {
                return isMention || isUserIgnored || isChannelIgnored || isGuildAllowed;
            }
        }

        

        showNotification(message, channel) {
            console.log("Creating notification element");
            const notificationElement = document.createElement('div');
            notificationElement.className = 'ping-notification glow';
            notificationElement.creationTime = Date.now();
            document.body.appendChild(notificationElement);

            ReactDOM.render(
                React.createElement(NotificationComponent, {
                    message: message,
                    channel: channel,
                    settings: this.settings,
                    onClose: () => this.removeNotification(notificationElement),
                    onClick: () => {
                        this.onNotificationClick(channel, message);
                        this.removeNotification(notificationElement);
                    },
                    onImageLoad: () => {
                        this.adjustNotificationPositions();
                    },
                    onSwipe: (direction) => {
                        const isRightSwipe = direction === 'right';
                        const isLeftSwipe = direction === 'left';
                        const isRightLocation = this.settings.popupLocation.endsWith("Right");
                        const isLeftLocation = this.settings.popupLocation.endsWith("Left");

                        if ((isRightSwipe && isRightLocation) || (isLeftSwipe && isLeftLocation)) {
                            this.removeNotification(notificationElement);
                        }
                    }
                }),
                notificationElement
            );

            this.activeNotifications.push(notificationElement);
            this.adjustNotificationPositions();

            return notificationElement;
        }

        removeNotification(notificationElement) {
            if (document.body.contains(notificationElement)) {
                ReactDOM.unmountComponentAtNode(notificationElement);
                document.body.removeChild(notificationElement);
                this.activeNotifications = this.activeNotifications.filter(n => n !== notificationElement);
                this.adjustNotificationPositions();
            }
        }

        removeAllNotifications() {
            this.activeNotifications.forEach(notification => {
                if (document.body.contains(notification)) {
                    ReactDOM.unmountComponentAtNode(notification);
                    document.body.removeChild(notification);
                }
            });
            this.activeNotifications = [];
        }

        adjustNotificationPositions() {
            const { popupLocation } = this.settings;
            let offset = 20;
            const isTop = popupLocation.startsWith("top");
            const isLeft = popupLocation.endsWith("Left");

            const sortedNotifications = [...this.activeNotifications].sort((a, b) => {
                return b.creationTime - a.creationTime;
            });

            sortedNotifications.forEach((notification) => {
                const height = notification.offsetHeight;
                notification.style.transition = 'all 0.3s ease-in-out';
                notification.style.position = 'fixed';

                if (isTop) {
                    notification.style.top = `${offset}px`;
                    notification.style.bottom = 'auto';
                } else {
                    notification.style.bottom = `${offset}px`;
                    notification.style.top = 'auto';
                }

                if (isLeft) {
                    notification.style.left = '20px';
                    notification.style.right = 'auto';
                } else {
                    notification.style.right = '20px';
                    notification.style.left = 'auto';
                }

                offset += height + 10;
            });
        }

        onNotificationClick(channel, message) {
            transitionTo(`/channels/${channel.guild_id || "@me"}/${channel.id}/${message.id}`);
        }

        getSettingsPanel() {
            return BdApi.React.createElement(SettingsPanel, {
                settings: this.settings,
                onSettingsChange: (newSettings) => {
                    this.settings = newSettings;
                    this.saveSettings();
                    this.adjustNotificationPositions();
                }
            });
        }

        css = `
            .ping-notification {
                position: fixed;
                width: 350px;
                background-color: rgba(255, 255, 255, 0.5);
                color: var(--text-normal);
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                z-index: 9999;
                overflow: hidden;
                backdrop-filter: blur(7px);
                animation: notificationPop 0.5s ease-out;
            }
            .ping-notification.glow {
                animation: notificationPop 0.5s ease-out, glowPulse 2s ease-out;
            }
            .ping-notification-content {
                padding: 12px;
                cursor: pointer;
                position: relative;
                color: var(--text-normal);
            }
            .ping-notification-header {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
            }
            .ping-notification-avatar {
                width: 24px;
                height: 24px;
                border-radius: 50%;
                margin-right: 8px;
            }
            .ping-notification-title {
                flex-grow: 1;
                font-weight: bold;
                font-size: 14px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .ping-notification-close {
                cursor: pointer;
                font-size: 18px;
                padding: 0 4px;
            }
                
            .ping-notification-video-attachment {
                position: relative;
                display: inline-block;
                align-self: center;
            }
            .ping-notification-video-play-button {
                opacity: 0.8;
                transition: opacity 0.2s ease;
            }
            .ping-notification-video-attachment:hover .ping-notification-video-play-button {
                opacity: 1;
            }
            .ping-notification-body {
                font-size: 15px;
                margin-bottom: 8px;
                word-break: break-word;
            }
            .ping-notification-attachment {
                max-width: 100%;
                max-height: 150px;
                border-radius: 4px;
                margin-top: 8px;
            }
            .ping-notification-content.privacy-mode .ping-notification-body,
            .ping-notification-content.privacy-mode .ping-notification-attachment {
                filter: blur(15px);
                transition: filter 0.3s ease;
            }
            .ping-notification-content.privacy-mode:hover .ping-notification-body,
            .ping-notification-content.privacy-mode:hover .ping-notification-attachment {
                filter: blur(0);
            }
            @keyframes notificationPop {
                0% { transform: scale(0.9); opacity: 0; }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes glowPulse {
                0% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
                50% { box-shadow: 0 0 20px rgba(255, 255, 255, 0.5); }
                100% { box-shadow: 0 0 5px rgba(255, 255, 255, 0.5); }
            }
        `;
        }

    function NotificationComponent({ message, channel, settings, onClose, onClick, onImageLoad, onSwipe }) {
        const [remainingTime, setRemainingTime] = React.useState(settings.duration);
        const [isPaused, setIsPaused] = React.useState(false);
        const [isGlowing, setIsGlowing] = React.useState(true);

        React.useEffect(() => {
            let interval;
            if (!isPaused) {
                interval = setInterval(() => {
                    setRemainingTime(prev => {
                        if (prev <= 100) {
                            clearInterval(interval);
                            onClose();
                            return 0;
                        }
                        return prev - 100;
                    });
                }, 100);
            }
            return () => clearInterval(interval);
        }, [isPaused, onClose, settings.duration]);

        React.useEffect(() => {
            const glowTimer = setTimeout(() => {
                setIsGlowing(false);
            }, 3000);
            return () => clearTimeout(glowTimer);
        }, []);

        const progress = (remainingTime / settings.duration) * 100;

        const getNotificationTitle = () => {
            let title = '';
            if (channel.guild_id) {
                const guild = GuildStore.getGuild(channel.guild_id);
                if (guild && guild.name) {
                    title = `• ${guild.name} • #${channel.name}`;
                } else {
                    title = `• Unknown Server • #${channel.name}`;
                }
            } else {
                title = `• DM`;
            }
            return title;
        };

        const getAvatarUrl = () => {
            return message.author.avatar
                ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator) % 5}.png`;
        };

        const getRoleColor = () => {
            if (!message.guild_id) {
                return null;
            }

            const guild = GuildStore.getGuild(message.guild_id);
            if (!guild) {
                return null;
            }

            const GuildMemberStore = Webpack.getModule(m => m.getMember);
            const member = GuildMemberStore.getMember(message.guild_id, message.author.id);
            
            if (!member || !member.roles) {
                return null;
            }

            const getRoles = Webpack.getModule(m => m.getRole);
            const guildRoles = getRoles.getRoles(guild.id);

            if (!guildRoles) {
                return null;
            }

            const roles = member.roles
                .map(roleId => guildRoles[roleId])
                .filter(role => role && typeof role.color === 'number' && role.color !== 0);

            if (roles.length === 0) return null;

            const colorRole = roles.sort((a, b) => (b.position || 0) - (a.position || 0))[0];
            return colorRole ? `#${colorRole.color.toString(16).padStart(6, '0')}` : null;
        };

        const getMentionedRoleColor = () => {
            if (!message.guild_id || !message.mention_roles || message.mention_roles.length === 0) {
                return null;
            }

            const guild = GuildStore.getGuild(message.guild_id);
            if (!guild) {
                return null;
            }

            const guildRoles = getRoles(guild);

            if (!guildRoles) {
                return null;
            }

            const mentionedRoles = message.mention_roles
                .map(roleId => guildRoles[roleId])
                .filter(role => role && typeof role.color === 'number' && role.color !== 0);

            if (mentionedRoles.length === 0) return null;

            const colorRole = mentionedRoles.sort((a, b) => (b.position || 0) - (a.position || 0))[0];
            return colorRole ? `#${colorRole.color.toString(16).padStart(6, '0')}` : null;
        };

        const roleColor = React.useMemo(() => getRoleColor(), [message.guild_id, message.author.id]);
        const mentionedRoleColor = React.useMemo(() => getMentionedRoleColor(), [message.guild_id, message.mention_roles]);

        const getEmbedContent = (embed) => {
            let content = [];
            if (embed.title) content.push(`**${embed.title}**`);
            if (embed.description) content.push(embed.description);
            if (embed.fields) {
                embed.fields.forEach(field => {
                    content.push(`**${field.name}:** ${field.value}`);
                });
            }
            if (embed.footer) content.push(`_${embed.footer.text}_`);
            return content.join('\n');
        };

        const renderAttachment = (attachment) => {
            if (attachment.content_type.startsWith('image/')) {
                return React.createElement('img', { 
                    src: attachment.url, 
                    alt: "Attachment", 
                    className: "ping-notification-attachment",
                    onLoad: onImageLoad
                });
            } else if (attachment.content_type.startsWith('video/')) {
                const thumbnailUrl = attachment.proxy_url + '?format=jpeg';
                return React.createElement('div', { 
                    className: "ping-notification-video-attachment",
                    style: { position: 'relative', display: 'inline-block', alignSelf: 'center' }
                },
                    React.createElement('img', {
                        src: thumbnailUrl,
                        alt: "Video Thumbnail",
                        className: "ping-notification-attachment",
                        onLoad: onImageLoad
                    }),
                    React.createElement('div', {
                        className: "ping-notification-video-play-button",
                        style: {
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '48px',
                            height: '48px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            borderRadius: '50%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center'
                        }
                    },
                        React.createElement('div', {
                            style: {
                                width: '0',
                                height: '0',
                                borderTop: '10px solid transparent',
                                borderBottom: '10px solid transparent',
                                borderLeft: '20px solid white',
                                marginLeft: '4px'
                            }
                        })
                    )
                );
            }
            return null;
        };

        const truncateMessage = (content, embedContent) => {
            const totalLength = content.length + (embedContent ? embedContent.length : 0);
            if (totalLength > 380) {
                const contentLimit = Math.max(100, 380 - (embedContent ? embedContent.length : 0));
                return content.substring(0, contentLimit) + (content.length > contentLimit ? "..." : "");
            }
            return content;
        };

        const getMessageContent = () => {
            let content = message.content;
            let embedContent = '';

            if (message.embeds && message.embeds.length > 0) {
                embedContent = message.embeds.map(embed => getEmbedContent(embed)).join('\n\n');
                if (embedContent) {
                    embedContent = `\n\n\n${embedContent}`;
                }
            }

            return truncateMessage(content, embedContent) + embedContent;
        };

        const getProgressColor = () => {
            const green = [67, 181, 129];
            const orange = [250, 166, 26];
            const red = [240, 71, 71];

            let color;
            if (progress > 66) {
                color = interpolateColor(orange, green, (progress - 66) / 34);
            } else if (progress > 33) {
                color = interpolateColor(red, orange, (progress - 33) / 33);
            } else {
                color = red;
            }

            return color;
        };

        const interpolateColor = (color1, color2, factor) => {
            return color1.map((channel, index) => 
                Math.round(channel + (color2[index] - channel) * factor)
            );
        };

        const progressColor = getProgressColor();
        const progressColorString = `rgb(${progressColor[0]}, ${progressColor[1]}, ${progressColor[2]})`;

        const getDisplayName = () => {
            if (settings.showNicknames && channel.guild_id) {
                const guild = GuildStore.getGuild(channel.guild_id);
                if (guild) {
                    const GuildMemberStore = Webpack.getModule(m => m.getMember);
                    const member = GuildMemberStore.getMember(guild.id, message.author.id);
                    if (member && member.nick) {
                        return member.nick;
                    }
                }
            }
            return message.author.username;
        };

        const handleSwipe = (e) => {
            const startX = e.touches ? e.touches[0].clientX : e.clientX;
            const handleMove = (moveEvent) => {
                const currentX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
                const deltaX = currentX - startX;
                const threshold = 100;

                if (Math.abs(deltaX) > threshold) {
                    onSwipe(deltaX > 0 ? 'right' : 'left');
                    document.removeEventListener('mousemove', handleMove);
                    document.removeEventListener('mouseup', handleEnd);
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleEnd);
                }
            };

            const handleEnd = () => {
                document.removeEventListener('mousemove', handleMove);
                document.removeEventListener('mouseup', handleEnd);
                document.removeEventListener('touchmove', handleMove);
                document.removeEventListener('touchend', handleEnd);
            };

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchmove', handleMove);
            document.addEventListener('touchend', handleEnd);
        };

        return React.createElement('div', {
            className: `ping-notification-content ${isGlowing ? 'glow' : ''} ${settings.privacyMode ? 'privacy-mode' : ''}`,
            onClick: onClick,
            onMouseEnter: () => setIsPaused(true),
            onMouseLeave: () => setIsPaused(false),
            onMouseDown: handleSwipe,
            onTouchStart: handleSwipe,
            style: { 
                position: 'relative', 
                overflow: 'hidden', 
                padding: '12px', 
                paddingBottom: '20px',
                minHeight: '60px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(41, 43, 47, 0.9)',
                backdropFilter: 'blur(5px)',
                animation: 'notificationPop 0.5s ease-out',
            }
        },
            React.createElement('div', { className: "ping-notification-header" },
                React.createElement('img', { src: getAvatarUrl(), alt: "Avatar", className: "ping-notification-avatar" }),
                React.createElement('div', { 
                    className: "ping-notification-title",
                    style: { display: 'flex', alignItems: 'center' }
                },
                    React.createElement('span', {
                        style: settings.coloredUsernames && roleColor ? { color: roleColor, fontWeight: 'bold', marginRight: '5px' } : { marginRight: '5px' }
                    }, getDisplayName()),
                    React.createElement('span', null, getNotificationTitle())
                ),
                React.createElement('div', { className: "ping-notification-close", onClick: (e) => { e.stopPropagation(); onClose(); } }, '×')
            ),
            React.createElement('div', { 
                className: "ping-notification-body",
                style: { flex: 1, marginBottom: '5px', color: mentionedRoleColor || 'inherit' }
            },
                parse(getMessageContent(), true, { channelId: channel.id })
            ),
            message.attachments && message.attachments.length > 0 && 
                renderAttachment(message.attachments[0]),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '5px',
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                }
            }),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '5px',
                    width: `${progress}%`,
                    backgroundColor: progressColorString,
                    transition: 'width 0.1s linear, background-color 0.5s ease',
                    zIndex: 1,
                }
            }),
            React.createElement('div', {
                style: {
                    position: 'absolute',
                    bottom: '7px',
                    right: '7px',
                    fontSize: '13px',
                    color: progressColorString,
                    transition: 'color 0.5s ease',
                    fontWeight: 'bold',
                }
            }, `${Math.round(remainingTime / 1000)}s`)
        );
    }

    function SettingsPanel({ settings, onSettingsChange }) {
        const [localSettings, setLocalSettings] = React.useState(settings);

        const handleChange = (key, value) => {
            const newSettings = { ...localSettings, [key]: value };
            setLocalSettings(newSettings);
            onSettingsChange(newSettings);
        };

        const openUserModal = () => {
            BdApi.showConfirmationModal(`Edit ${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Users`, 
                React.createElement(UserSelectionModal, {
                    currentUsers: localSettings.ignoredUsers,
                    onSave: (newUsers) => handleChange('ignoredUsers', newUsers),
                    isBlacklistMode: localSettings.isBlacklistMode
                }),
                {
                    confirmText: "Save",
                    cancelText: "Cancel",
                    onConfirm: () => {}
                }
            );
        };

        const openChannelModal = () => {
            BdApi.showConfirmationModal(`Edit ${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Channels`, 
                React.createElement(ChannelSelectionModal, {
                    currentChannels: localSettings.ignoredChannels,
                    onSave: (newChannels) => handleChange('ignoredChannels', newChannels),
                    isBlacklistMode: localSettings.isBlacklistMode
                }),
                {
                    confirmText: "Save",
                    cancelText: "Cancel",
                    onConfirm: () => {},
                    width: "600px"
                }
            );
        };

        return React.createElement('div', { style: { color: 'var(--header-primary)', padding: '16px' } },
            React.createElement('h2', { style: { marginBottom: '16px' } }, "PingNotification Settings"),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                    React.createElement('input', {
                        type: "checkbox",
                        checked: localSettings.isBlacklistMode,
                        onChange: (e) => handleChange('isBlacklistMode', e.target.checked),
                        style: { marginRight: '8px' }
                    }),
                    localSettings.isBlacklistMode ? "Blacklist Mode" : "Whitelist Mode"
                )
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                    React.createElement('input', {
                        type: "checkbox",
                        checked: localSettings.privacyMode,
                        onChange: (e) => handleChange('privacyMode', e.target.checked),
                        style: { marginRight: '8px' }
                    }),
                    "Privacy Mode"
                )
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                    React.createElement('input', {
                        type: "checkbox",
                        checked: localSettings.allowNotificationsInCurrentChannel,
                        onChange: (e) => handleChange('allowNotificationsInCurrentChannel', e.target.checked),
                        style: { marginRight: '8px' }
                    }),
                    "Allow notifications in channels you're currently viewing"
                )
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                    React.createElement('input', {
                        type: "checkbox",
                        checked: localSettings.coloredUsernames,
                        onChange: (e) => handleChange('coloredUsernames', e.target.checked),
                        style: { marginRight: '8px' }
                    }),
                    "Color senders username based on their role"
                )
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
                    React.createElement('input', {
                        type: "checkbox",
                        checked: localSettings.showNicknames,
                        onChange: (e) => handleChange('showNicknames', e.target.checked),
                        style: { marginRight: '8px' }
                    }),
                    "Show nicknames instead of username"
                )
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, `Notification Duration: ${localSettings.duration / 1000} seconds`),
                React.createElement('input', { 
                    type: "range", 
                    min: "1000", 
                    max: "30000", 
                    step: "1000",
                    value: localSettings.duration, 
                    onChange: (e) => handleChange('duration', parseInt(e.target.value)),
                    style: { width: '100%' }
                })
            ),
            
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, 
                    `${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Users:`
                ),
                React.createElement('button', { 
                    onClick: openUserModal,
                    style: { padding: '8px', marginTop: '4px' }
                }, "Edit")
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, 
                    `${localSettings.isBlacklistMode ? "Ignored" : "Allowed"} Channels:`
                ),
                React.createElement('button', { 
                    onClick: openChannelModal,
                    style: { padding: '8px', marginTop: '4px' }
                }, "Edit")
            ),
            React.createElement('div', { style: { marginBottom: '16px' } },
                React.createElement('label', { style: { display: 'block', marginBottom: '8px' } }, "Popup Location:"),
                React.createElement('select', { 
                    value: localSettings.popupLocation, 
                    onChange: (e) => handleChange('popupLocation', e.target.value),
                    style: { width: '100%', padding: '8px' }
                },
                    React.createElement('option', { value: "topLeft" }, "Top Left"),
                    React.createElement('option', { value: "topRight" }, "Top Right"),
                    React.createElement('option', { value: "bottomLeft" }, "Bottom Left"),
                    React.createElement('option', { value: "bottomRight" }, "Bottom Right")
                )
            ),
            
            React.createElement('div', null,
                React.createElement('h3', { style: { marginBottom: '8px' } }, 
                    `${localSettings.isBlacklistMode ? "Allowed" : "Ignored"} Guilds:`
                ),
                Object.entries(GuildStore.getGuilds()).map(([id, guild]) => 
                    React.createElement('div', { key: id, style: { marginBottom: '8px' } },
                        React.createElement('label', null,
                            React.createElement('input', { 
                                type: "checkbox", 
                                checked: localSettings.allowedGuilds[id] || false, 
                                onChange: (e) => handleChange('allowedGuilds', { ...localSettings.allowedGuilds, [id]: e.target.checked })
                            }),
                            ' ',
                            guild.name
                        )
                    )
                )
            )
            
        );
    }

    function UserSelectionModal({ currentUsers, onSave, isBlacklistMode }) {
        const [selectedUsers, setSelectedUsers] = React.useState(new Set(currentUsers));
        const [searchTerm, setSearchTerm] = React.useState("");
        const [filteredFriends, setFilteredFriends] = React.useState([]);

        const friends = React.useMemo(() => {
            return RelationshipStore.getFriendIDs()
                .map(id => UserStore.getUser(id))
                .filter(user => user != null);
        }, []);

        const sortedFriends = React.useMemo(() => {
            return friends.sort((a, b) => {
                const aSelected = selectedUsers.has(a.id);
                const bSelected = selectedUsers.has(b.id);
                if (aSelected === bSelected) {
                    return a.username.localeCompare(b.username);
                }
                return aSelected ? -1 : 1;
            });
        }, [friends, selectedUsers]);

        React.useEffect(() => {
            const filtered = sortedFriends.filter(friend => 
                friend.username.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredFriends(filtered);
        }, [searchTerm, sortedFriends]);

        const toggleUser = (userId) => {
            setSelectedUsers(prevSelected => {
                const newSelected = new Set(prevSelected);
                if (newSelected.has(userId)) {
                    newSelected.delete(userId);
                } else {
                    newSelected.add(userId);
                }
                const newSelectedArray = Array.from(newSelected);
                onSave(newSelectedArray);
                return newSelected;
            });
        };

        const VirtualizedUserList = ({ users }) => {
            const listRef = React.useRef();
            const rowHeight = 40;
            const windowHeight = 300;
            const [scrollTop, setScrollTop] = React.useState(0);

            const onScroll = React.useCallback(
                (e) => setScrollTop(e.currentTarget.scrollTop),
                []
            );

            const startIndex = Math.floor(scrollTop / rowHeight);
            const endIndex = Math.min(users.length - 1, Math.floor((scrollTop + windowHeight) / rowHeight));

            const items = [];
            for (let i = startIndex; i <= endIndex; i++) {
                const user = users[i];
                items.push(
                    React.createElement('div', {
                        key: user.id,
                        style: {
                            height: rowHeight,
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            color: 'var(--text-normal)'
                        }
                    },
                        React.createElement('input', {
                            type: "checkbox",
                            checked: selectedUsers.has(user.id),
                            onChange: () => toggleUser(user.id),
                            style: { marginRight: '8px' }
                        }),
                        user.username
                    )
                );
            }

            return React.createElement('div', {
                ref: listRef,
                onScroll: onScroll,
                style: {
                    height: windowHeight,
                    overflowY: 'auto',
                    backgroundColor: 'var(--background-secondary)',
                    borderRadius: '4px'
                }
            },
                React.createElement('div', {
                    style: { height: users.length * rowHeight, position: 'relative' }
                },
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            top: startIndex * rowHeight,
                            width: '100%'
                        }
                    }, items)
                )
            );
        };

        return React.createElement(React.Fragment, null,
            React.createElement('h3', { 
                style: { 
                    marginBottom: '16px', 
                    color: 'var(--header-primary)',
                    textAlign: 'center'
                } 
            }, `${isBlacklistMode ? "Ignored" : "Allowed"} Users`),
            React.createElement('input', {
                type: "text",
                placeholder: "Search users...",
                value: searchTerm,
                onChange: (e) => setSearchTerm(e.target.value),
                style: { 
                    width: '100%', 
                    padding: '8px', 
                    marginBottom: '16px',
                    color: 'var(--text-normal)',
                    backgroundColor: 'var(--background-secondary)',
                    border: 'none',
                    borderRadius: '4px'
                }
            }),
            React.createElement(VirtualizedUserList, { users: filteredFriends })
        );
    }

    function ChannelSelectionModal({ currentChannels, onSave, isBlacklistMode }) {
        const [selectedChannels, setSelectedChannels] = React.useState(new Set(currentChannels));
        const [selectedGuild, setSelectedGuild] = React.useState(null);
        const [searchTerm, setSearchTerm] = React.useState("");
        const channelListRef = React.useRef(null);

        const guilds = Object.values(GuildStore.getGuilds());
        const GuildChannelsStore = Webpack.getStore("GuildChannelStore");

        const countSelectedChannelsForGuild = React.useCallback((guildId) => {
            const guildChannels = GuildChannelsStore.getChannels(guildId);
            const textChannels = guildChannels.SELECTABLE.map(channel => channel.channel).filter(channel => channel.type === 0);
            return textChannels.filter(channel => selectedChannels.has(channel.id)).length;
        }, [selectedChannels]);

        const sortedGuilds = React.useMemo(() => {
            return guilds.sort((a, b) => {
                const aCount = countSelectedChannelsForGuild(a.id);
                const bCount = countSelectedChannelsForGuild(b.id);
                if (aCount === bCount) {
                    return a.name.localeCompare(b.name);
                }
                return bCount - aCount;
            });
        }, [guilds, countSelectedChannelsForGuild]);

        const filteredGuilds = React.useMemo(() => 
            sortedGuilds.filter(guild => 
                guild.name.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [sortedGuilds, searchTerm]);

        const toggleChannel = (channelId) => {
            setSelectedChannels(prev => {
                const newSet = new Set(prev);
                if (newSet.has(channelId)) {
                    newSet.delete(channelId);
                } else {
                    newSet.add(channelId);
                }
                onSave(Array.from(newSet));
                return newSet;
            });
        };

        const selectGuild = (guild) => {
            setSelectedGuild(guild);
            if (channelListRef.current) {
                channelListRef.current.scrollTop = 0;
            }
        };

        const renderGuildList = () => {
            return React.createElement(React.Fragment, null,
                React.createElement('input', {
                    type: "text",
                    placeholder: "Search guilds...",
                    value: searchTerm,
                    onChange: (e) => setSearchTerm(e.target.value),
                    style: { 
                        width: '100%', 
                        padding: '8px', 
                        marginBottom: '16px',
                        color: 'var(--text-normal)',
                        backgroundColor: 'var(--background-secondary)',
                        border: 'none',
                        borderRadius: '4px'
                    }
                }),
                React.createElement('div', { 
                    style: { 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        overflowX: 'hidden',
                        paddingRight: '15px'
                    } 
                },
                    filteredGuilds.map(guild => {
                        const selectedCount = countSelectedChannelsForGuild(guild.id);
                        return React.createElement('div', { 
                            key: guild.id, 
                            onClick: () => selectGuild(guild),
                            style: { 
                                cursor: 'pointer', 
                                padding: '8px', 
                                marginBottom: '8px', 
                                backgroundColor: 'var(--background-secondary)',
                                color: 'var(--text-normal)',
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'box-shadow 0.2s ease',
                                boxShadow: selectedCount > 0 ? '0 0 0 1px var(--brand-experiment), 0 0 0 3px var(--brand-experiment-15a)' : 'none',
                                position: 'relative',
                                left: selectedCount > 0 ? '3px' : '0',
                                width: selectedCount > 0 ? 'calc(100% - 3px)' : '100%' 
                            }
                        },
                            React.createElement('span', {
                                style: {
                                    fontWeight: selectedCount > 0 ? 'bold' : 'normal'
                                }
                            }, guild.name),
                            selectedCount > 0 && React.createElement('span', {
                                style: {
                                    backgroundColor: 'var(--brand-experiment)',
                                    color: 'white',
                                    borderRadius: '12px',
                                    padding: '4px 8px',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                                    marginRight: '15px'
                                }
                            }, selectedCount)
                        );
                    })
                )
            );
        };

        const renderChannelList = () => {
            const guildChannels = GuildChannelsStore.getChannels(selectedGuild.id);
            const textChannels = guildChannels.SELECTABLE.map(channel => channel.channel).filter(channel => channel.type === 0);

            const sortedChannels = textChannels.sort((a, b) => {
                const aSelected = selectedChannels.has(a.id);
                const bSelected = selectedChannels.has(b.id);
                if (aSelected === bSelected) {
                    return a.name.localeCompare(b.name);
                }
                return aSelected ? -1 : 1;
            });

            return React.createElement(React.Fragment, null,
                React.createElement('button', { 
                    onClick: () => setSelectedGuild(null),
                    style: { 
                        marginBottom: '16px',
                        padding: '8px',
                        backgroundColor: 'var(--background-modifier-accent)',
                        color: 'var(--text-normal)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }
                }, "Back to Guilds"),
                React.createElement('div', { 
                    ref: channelListRef,
                    style: { maxHeight: '300px', overflowY: 'auto' }
                },
                    sortedChannels.map(channel => 
                        React.createElement('div', { key: channel.id, style: { marginBottom: '8px', color: 'var(--text-normal)' } },
                            React.createElement('label', null,
                                React.createElement('input', {
                                    type: "checkbox",
                                    checked: selectedChannels.has(channel.id),
                                    onChange: () => toggleChannel(channel.id),
                                    style: { marginRight: '8px' }
                                }),
                                channel.name
                            )
                        )
                    )
                )
            );
        };

        return React.createElement(React.Fragment, null,
            React.createElement('h3', { 
                style: { 
                    marginBottom: '16px', 
                    color: 'var(--header-primary)',
                    textAlign: 'center'
                } 
            }, `${isBlacklistMode ? "Ignored" : "Allowed"} Channels`),
            selectedGuild ? renderChannelList() : renderGuildList()
        );
    }


    
    function getRoles(guild) {
        return guild?.roles ?? BdApi.findModuleByProps("getGuild").getGuild(guild?.id)?.roles;
    }
