/**
 * @name PingNotification
 * @author DaddyBoard
 * @version 7.0.1
 * @description A BetterDiscord plugin to show in-app notifications for mentions, DMs, and messages in specific guilds.
 * @website https://github.com/DaddyBoard/PingNotification
 * @source https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js
 * @updateUrl https://github.com/DaddyBoard/PingNotification/blob/main/PingNotification.plugin.js
 * @invite ggNWGDV7e2
 */

const { React, Webpack, ReactDOM } = BdApi;

const UserStore = Webpack.getStore("UserStore");
const ChannelStore = Webpack.getStore("ChannelStore"); 
const GuildStore = Webpack.getStore("GuildStore");
const SelectedChannelStore = Webpack.getStore("SelectedChannelStore");
const RelationshipStore = Webpack.getStore("RelationshipStore");
const UserGuildSettingsStore = Webpack.getStore("UserGuildSettingsStore");
const transitionTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{searchExports:true});
const MessageParserModule = Webpack.getModule(m => m.defaultRules && m.parse);
const parse = MessageParserModule?.parse;
const GuildMemberStore = Webpack.getModule(m => m.getMember);
const Dispatcher = BdApi.Webpack.getByKeys("subscribe", "dispatch")
const MessageStore = BdApi.Webpack.getStore("MessageStore");
const MessageAccessories = BdApi.Webpack.getByPrototypeKeys("renderEmbeds", {searchExports:true});
const MessageActions = BdApi.Webpack.getByKeys("fetchMessage", "deleteMessage");

module.exports = class PingNotification {

    showChangelog() {
        try {
            const changelogContent = Array.isArray(this.config.changelog) 
                ? this.config.changelog.map((change, index) => {
                    const isNew = index === 0;
                    return `# __v${change.title}__ ${isNew ? '🆕' : ''}\r\n\r\n${change.items.map(item => `• ${item}`).join('\r\n\r\n')}`;
                }).join('\r\n\r\n\r\n')
                : "No changelog available.";

            BdApi.UI.showConfirmationModal(
                "PingNotification Changelog",
                changelogContent,
                {
                    confirmText: "Close",
                    cancelText: null
                }
            );

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
                version: "7.0.1",
                description: "Shows in-app notifications for mentions, DMs, and messages in specific guilds with React components.",
                github: "https://github.com/DaddyBoard/PingNotification",
                github_raw: "https://raw.githubusercontent.com/DaddyBoard/PingNotification/main/PingNotification.plugin.js"
            },
            changelog: [
                {
                    title: "7.0.1",
                    items: [
                        "Fixed accidental breakage of mentions, inline replies, role mentions, @everyone, and @here. Sorry about that!"
                    ]
                },
                {
                    title: "7.0.0 - HUGE UPDATE",
                    items: [
                        "Fully rewritten (again) to use MessageAccessories, this allows for near-native rendering of various message components, like embeds, attachments, and more.",
                        "Now shows in-line reply context (ReferencedMessage)",
                        "Now supports updating messages (embeds changing, users editing messages)",
                        "Now also supports tracking reactions to messages!",
                        "So much more, can't even remember all the stuff I've added!"
                    ]
                },
                {
                    title: "6.3.6",
                    items: [
                        "Removed patchDispatcher method, replaced with a more reliable method of subscribing to the MESSAGE_CREATE event.\n Thank you @doggybootsy for the help with this!",
                        "Ensured links to things such as youtube etc don't spam a huge embed in the notification popup."
                    ]
                }
            ],
            main: "index.js"
        };


        this.defaultSettings = {
                duration: 15000,
                popupLocation: "bottomRight",
                allowNotificationsInCurrentChannel: false,
                privacyMode: false,
                coloredUsernames: true,
                showNicknames: true,
                applyNSFWBlur: false
            };
            this.activeNotifications = [];

        this.loadSettings();
        
        const lastVersion = BdApi.getData('PingNotification', 'lastVersion');
        if (lastVersion !== this.config.info.version) {
            this.showChangelog();
            BdApi.setData('PingNotification', 'lastVersion', this.config.info.version);
        }
        this.onMessageReceived = this.onMessageReceived.bind(this);
    }

    getName() { return this.config.info.name; }
    getAuthor() { return this.config.info.authors.map(a => a.name).join(", "); }
    getDescription() { return this.config.info.description; }
    getVersion() { return this.config.info.version; }

    start() {
        this.loadSettings();        
        this.messageCreateHandler = async (event) => {
            if (!event?.message) return;
            try {
                let message = MessageStore.getMessage(event.message.channel_id, event.message.id) || 
                              await MessageActions.fetchMessage({ 
                                  channelId: event.message.channel_id, 
                                  messageId: event.message.id 
                              });
                
                if (message.messageReference) {
                    const referencedMessage = MessageStore.getMessage(
                        message.messageReference.channel_id, 
                        message.messageReference.message_id
                    ) || await MessageActions.fetchMessage({
                        channelId: message.messageReference.channel_id,
                        messageId: message.messageReference.message_id
                    });
                    
                    if (referencedMessage) {
                        message.messageReference.author = referencedMessage.author;
                        message.messageReference.message = referencedMessage;
                    }
                }
                
                if (message) {
                    this.onMessageReceived(message);
                }
            } catch (error) {
                console.error("PingNotification: Error fetching message", error);
            }
        };

        this.messageUpdateHandler = async (event) => {
            if (!event?.message) return;
            const activeNotification = this.activeNotifications.find(n => 
                n.messageId === event.message.id && n.channelId === event.message.channel_id
            );

            if (activeNotification) {
                try {
                    let updatedMessage = MessageStore.getMessage(event.message.channel_id, event.message.id) || 
                                       await MessageActions.fetchMessage({ 
                                           channelId: event.message.channel_id, 
                                           messageId: event.message.id 
                                       });
                    
                    if (updatedMessage.messageReference) {
                        const referencedMessage = MessageStore.getMessage(
                            updatedMessage.messageReference.channel_id,
                            updatedMessage.messageReference.message_id
                        ) || await MessageActions.fetchMessage({
                            channelId: updatedMessage.messageReference.channel_id,
                            messageId: updatedMessage.messageReference.message_id
                        });

                        if (referencedMessage) {
                            updatedMessage.messageReference.message = referencedMessage;
                            updatedMessage.messageReference.author = referencedMessage.author;
                        }
                    }
                    
                    if (updatedMessage) {
                        this.updateNotification(activeNotification, updatedMessage);
                    }
                } catch (error) {
                    console.error("PingNotification: Error fetching updated message", error);
                }
            }
        };

        this.reactionAddHandler = async (event) => {
            if (!event?.messageId) return;
            const activeNotification = this.activeNotifications.find(n => 
                n.messageId === event.messageId && n.channelId === event.channelId
            );

            if (activeNotification) {
                try {
                    const updatedMessage = MessageStore.getMessage(event.channelId, event.messageId) || 
                                         await MessageActions.fetchMessage({ 
                                             channelId: event.channelId, 
                                             messageId: event.messageId 
                                         });
                    
                    if (updatedMessage) {
                        this.updateNotification(activeNotification, updatedMessage);
                    }
                } catch (error) {
                    console.error("PingNotification: Error fetching message for reaction update", error);
                }
            }
        };

        this.reactionRemoveHandler = this.reactionAddHandler;

        Dispatcher.subscribe("MESSAGE_CREATE", this.messageCreateHandler);
        Dispatcher.subscribe("MESSAGE_UPDATE", this.messageUpdateHandler);
        Dispatcher.subscribe("MESSAGE_REACTION_ADD", this.reactionAddHandler);
        Dispatcher.subscribe("MESSAGE_REACTION_REMOVE", this.reactionRemoveHandler);
        BdApi.DOM.addStyle("PingNotificationStyles", this.css);
    }

    stop() {
        if (Dispatcher) {
            Dispatcher.unsubscribe("MESSAGE_CREATE", this.messageCreateHandler);
            Dispatcher.unsubscribe("MESSAGE_UPDATE", this.messageUpdateHandler);
            Dispatcher.unsubscribe("MESSAGE_REACTION_ADD", this.reactionAddHandler);
            Dispatcher.unsubscribe("MESSAGE_REACTION_REMOVE", this.reactionRemoveHandler);
        }
        this.removeAllNotifications();
        BdApi.DOM.removeStyle("PingNotificationStyles");
    }

    loadSettings() {
        this.settings = { ...this.defaultSettings, ...BdApi.Data.load("PingNotification", "settings") };
    }

    saveSettings() {
        BdApi.Data.save("PingNotification", "settings", this.settings);
    }


    css = `
        .ping-notification {
            position: fixed;
            width: 370px;
            background-color: rgba(30, 31, 34, 0.95);
            color: var(--text-normal);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1);
            z-index: 9999;
            overflow: hidden;
            backdrop-filter: blur(10px);
            animation: notificationPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform: translateZ(0);
        }
        @keyframes notificationPop {
            0% { transform: scale(0.9) translateZ(0); opacity: 0; }
            100% { transform: scale(1) translateZ(0); opacity: 1; }
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
        .ping-notification-body {
            font-size: 15px;
            margin-bottom: 8px;
            word-break: break-word;
            scrollbar-width: none;
            -ms-overflow-style: none;
        }
        .ping-notification-body::-webkit-scrollbar {
            display: none;
        }
        .ping-notification-content.privacy-mode .ping-notification-body,
        .ping-notification-content.privacy-mode .ping-notification-attachment {
            filter: blur(20px);
            transition: filter 0.3s ease;
            position: relative;
        }
        .ping-notification-hover-text {
            position: absolute;
            top: calc(50% + 20px);
            left: 50%;
            transform: translate(-50%, -50%);
            color: var(--text-normal);
            font-size: 14px;
            font-weight: 500;
            pointer-events: none;
            opacity: 1;
            transition: opacity 0.3s ease;
            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
            white-space: nowrap;
            z-index: 100;
            background-color: rgba(0, 0, 0, 0.7);
            padding: 4px 8px;
            border-radius: 4px;
        }
        .ping-notification-content.privacy-mode:hover .ping-notification-hover-text {
            opacity: 0;
        }
        .ping-notification-content.privacy-mode:hover .ping-notification-body,
        .ping-notification-content.privacy-mode:hover .ping-notification-attachment {
            filter: blur(0);
        }
        .pingNotification-settings {
            padding: 20px;
            color: var(--text-normal);
            font-family: var(--font-primary);
        }
        .pingNotification-section {
            background-color: var(--background-secondary);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .pingNotification-section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
        }
        .pingNotification-setting {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
        }
        .pingNotification-separator {
            height: 1px;
            background-color: var(--background-modifier-accent);
            margin: 5px 0;
        }
        .pingNotification-label {
            font-size: 14px;
        }
        .pingNotification-switch {
            width: 25.5px;
            height: 15.5px;
            background-color: rgba(255, 77, 77, 0.5);
            border-radius: 7.75px;
            position: relative;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .pingNotification-switch.checked {
            background-color: rgba(76, 217, 100, 0.5);
        }
        .pingNotification-switch-slider {
            width: 13.5px;
            height: 13.5px;
            background-color: var(--background-primary);
            border-radius: 50%;
            position: absolute;
            top: 1px;
            left: 1px;
            transition: transform 0.3s;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        .pingNotification-switch.checked .pingNotification-switch-slider {
            transform: translateX(10px);
        }
        .pingNotification-duration {
            display: flex;
            align-items: center;
        }
        .pingNotification-slider {
            flex-grow: 1;
            margin-right: 10px;
        }
        .pingNotification-duration-input {
            width: 50px;
            text-align: center;
            background-color: var(--background-tertiary);
            border: none;
            border-radius: 5px;
            color: var(--text-normal);
            padding: 5px;
            margin-right: 5px;
        }
        .pingNotification-select {
            background-color: var(--background-tertiary);
            color: var(--text-normal);
            border: none;
            border-radius: 5px;
            padding: 5px 10px;
            font-size: 14px;
        }

        .ping-notification .spoilerContent_aa9639,
        .ping-notification .spoilerMarkdownContent_aa9639 {
            background-color: rgba(255, 255, 255, 0.15);
            border-radius: 3px;
            transition: background-color 0.2s ease;
        }

        .ping-notification-media img,
        .ping-notification-media video,
        .ping-notification-media [class*="clickableMedia"],
        .ping-notification-media [class*="imageContainer"],
        .ping-notification-media [class*="videoContainer"],
        .ping-notification-media [class*="wrapper"],
        .ping-notification-media [class*="imageWrapper"] {
            max-width: 100% !important;
            max-height: 250px !important;
            object-fit: contain !important;
            pointer-events: auto !important;
            -webkit-user-drag: none !important;
            user-drag: none !important;
            -webkit-touch-callout: none !important;
        }

        .ping-notification-media [class*="spoilerContent"],
        .ping-notification-media [class*="hiddenSpoilers"] {
            max-width: 100% !important;
            max-height: 250px !important;
            width: auto !important;
            height: auto !important;
        }

        .ping-notification-media [class*="draggableWrapper"] {
            pointer-events: none !important;
        }
        .ping-notification [class*="hoverButtonGroup_d0395d"],
        .ping-notification [class*="codeActions_f8f345"],
        .ping-notification [class*="reactionBtn"] {
            display: none !important;
        }

        .ping-notification code {
            background-color: var(--background-secondary);
            border-radius: 3px;
            padding: 0.2em 0.4em;
            margin: 0;
            font-size: 85%;
            font-family: var(--font-code);
            color: var(--text-normal);
        }

        .ping-notification pre {
            background-color: var(--background-secondary);
            border-radius: 4px;
            padding: 0.5em;
            margin: 0.5em 0;
            overflow-x: auto;
        }

        .ping-notification pre code {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            font-size: 85%;
            color: var(--text-normal);
            white-space: pre;
            word-spacing: normal;
            word-break: normal;
            word-wrap: normal;
            line-height: 1.45;
        }
    `;

    onMessageReceived(message) {
        if (!message?.channel_id) return;  
        const channel = ChannelStore.getChannel(message.channel_id);
        const currentUser = UserStore.getCurrentUser();

        if (!channel || message.author.id === currentUser.id) return;

        if (this.shouldNotify(message, channel, currentUser)) {
            this.showNotification(message, channel);
        }
    }

    shouldNotify(message, channel, currentUser) {
        if (!this.settings.allowNotificationsInCurrentChannel && 
            channel.id === SelectedChannelStore.getChannelId()) {
            return false;
        }

        if (message.author.id === currentUser.id) return false;
        if (message.flags && (message.flags & 64) === 64) return false;

        if (!channel.guild_id) {
            const isGroupDMMuted = UserGuildSettingsStore.isChannelMuted(null, channel.id);
            const isUserBlocked = RelationshipStore.isBlocked(message.author.id);
            return !isGroupDMMuted && !isUserBlocked;
        }

        if (UserGuildSettingsStore.isGuildOrCategoryOrChannelMuted(channel.guild_id, channel.id)) {
            return false;
        }

        const channelOverride = UserGuildSettingsStore.getChannelMessageNotifications(channel.guild_id, channel.id);
        const guildDefault = UserGuildSettingsStore.getMessageNotifications(channel.guild_id);
        const finalSetting = channelOverride === 3 ? guildDefault : channelOverride;

        const isDirectlyMentioned = message.mentions?.includes(currentUser.id);
        const isEveryoneMentioned = message.mentionEveryone && 
            !UserGuildSettingsStore.isSuppressEveryoneEnabled(channel.guild_id);

        let isRoleMentioned = false;
        if (message.mentionRoles?.length > 0 && 
            !UserGuildSettingsStore.isSuppressRolesEnabled(channel.guild_id)) {
            const member = GuildMemberStore.getMember(channel.guild_id, currentUser.id);
            if (member?.roles) {
                isRoleMentioned = message.mentionRoles.some(roleId => 
                    member.roles.includes(roleId)
                );
            }
        }

        const isMentioned = isDirectlyMentioned || isEveryoneMentioned || isRoleMentioned;

        switch (finalSetting) {
            case 0: return true;
            case 1: return isMentioned;
            case 2: return false;
            default: return false;
        }
    }

    showNotification(message, channel) {
        const notificationElement = BdApi.DOM.createElement('div');
        notificationElement.className = 'ping-notification';
        notificationElement.creationTime = Date.now();
        notificationElement.channelId = channel.id;
        notificationElement.messageId = message.id;
        document.body.appendChild(notificationElement);

        ReactDOM.render(
            React.createElement(NotificationComponent, {
                message: message,
                channel: channel,
                settings: this.settings,
                onClose: () => { 
                    this.removeNotification(notificationElement);
                },
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
        const notificationsToRemove = this.activeNotifications.filter(notification => 
            notification.channelId === channel.id
        );
        
        notificationsToRemove.forEach(notification => {
            this.removeNotification(notification);
        });

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

    updateNotification(notificationElement, updatedMessage) {
        ReactDOM.render(
            React.createElement(NotificationComponent, {
                message: updatedMessage,
                channel: ChannelStore.getChannel(updatedMessage.channel_id),
                settings: this.settings,
                onClose: () => { 
                    this.removeNotification(notificationElement);
                },
                onClick: () => {
                    this.onNotificationClick(ChannelStore.getChannel(updatedMessage.channel_id), updatedMessage);
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
            notificationElement,
            () => {
                requestAnimationFrame(() => {
                    this.adjustNotificationPositions();
                });
            }
        );
    }
}

    function NotificationComponent({ message, channel, settings, onClose, onClick, onImageLoad, onSwipe }) {
        const guild = channel.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
        const member = guild ? GuildMemberStore.getMember(guild.id, message.author.id) : null;

        const [remainingTime, setRemainingTime] = React.useState(settings.duration);
        const [isPaused, setIsPaused] = React.useState(false);

        const notificationTitle = React.useMemo(() => {
            let title = '';
            const isNSFW = channel.nsfw || channel.nsfw_;

            if (channel.guild_id) {
                title = guild ? `${guild.name} • #${channel.name}` : `Unknown Server • #${channel.name}`;
            } else if (channel.type === 3) {
                const recipients = channel.recipients?.map(id => UserStore.getUser(id)).filter(u => u);
                const name = channel.name || recipients?.map(u => u.username).join(', ');
                title = `Group Chat • ${name}`;
            } else {
                title = `Direct Message`;
            }

            if (isNSFW && settings.applyNSFWBlur) {
                title += ' • ';
                return React.createElement('div', { style: { display: 'flex', alignItems: 'center' } },
                    title,
                    React.createElement('span', {
                        style: {
                            color: 'rgb(240, 71, 71)',
                            fontWeight: 'bold',
                            marginLeft: '4px'
                        }
                    }, 'NSFW')
                );
            }

            return title;
        }, [channel, guild?.name, settings.applyNSFWBlur]);

        const roleColor = React.useMemo(() => {
            if (!guild || !member || !member.roles) return null;
            const getRoles = Webpack.getModule(m => m.getRole);
            const guildRoles = getRoles.getRoles(guild.id);
            if (!guildRoles) return null;
            
            const roles = member.roles
                .map(roleId => guildRoles[roleId])
                .filter(role => role && typeof role.color === 'number' && role.color !== 0);
            
            if (roles.length === 0) return null;
            const colorRole = roles.sort((a, b) => (b.position || 0) - (a.position || 0))[0];
            return colorRole ? `#${colorRole.color.toString(16).padStart(6, '0')}` : null;
        }, [guild?.id, member?.roles]);

        const displayName = React.useMemo(() => {
            if (settings.showNicknames && member?.nick) {
                return member.nick;
            }
            return message.author.username;
        }, [settings.showNicknames, member?.nick, message.author.username]);

        const avatarUrl = React.useMemo(() => {
            return message.author.avatar
                ? `https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png?size=128`
                : `https://cdn.discordapp.com/embed/avatars/${parseInt(message.author.discriminator) % 5}.png`;
        }, [message.author]);

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

        const progress = (remainingTime / settings.duration) * 100;

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
            className: `ping-notification-content ${
                settings.privacyMode || (settings.applyNSFWBlur && (channel.nsfw || channel.nsfw_)) 
                ? 'privacy-mode' 
                : ''
            }`,
            onClick: onClick,
            onMouseEnter: () => setIsPaused(true),
            onMouseLeave: () => setIsPaused(false),
            onMouseDown: handleSwipe,
            onTouchStart: handleSwipe,
            style: { 
                position: 'relative', 
                overflow: 'hidden', 
                padding: '16px', 
                paddingBottom: '24px',
                minHeight: '80px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'rgba(30, 31, 34, 0.95)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 1px rgba(255, 255, 255, 0.1)',
                transform: 'translateZ(0)',
                transition: 'all 0.3s ease',
                userSelect: 'none',
                WebkitUserDrag: 'none',
            }
        },
            React.createElement('div', { className: "ping-notification-header" },
                React.createElement('img', { 
                    src: avatarUrl, 
                    alt: "Avatar", 
                    className: "ping-notification-avatar",
                    style: {
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        border: '2px solid var(--brand-experiment)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }
                }),
                React.createElement('div', { 
                    className: "ping-notification-title",
                    style: { 
                        display: 'flex', 
                        flexDirection: 'column',
                        marginLeft: '12px'
                    }
                },
                    React.createElement('span', {
                        style: {
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: settings.coloredUsernames && roleColor ? roleColor : 'var(--header-primary)',
                            marginBottom: '2px'
                        }
                    }, displayName),
                    React.createElement('span', {
                        style: {
                            fontSize: '12px',
                            color: 'var(--text-muted)'
                        }
                    }, notificationTitle)
                ),
                React.createElement('div', { 
                    className: "ping-notification-close", 
                    onClick: (e) => { e.stopPropagation(); onClose(); },
                    style: {
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        color: 'var(--interactive-normal)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: 'var(--interactive-hover)'
                        }
                    }
                }, 
                    React.createElement('svg', {
                        width: '14',
                        height: '14',
                        viewBox: '0 0 24 24',
                        fill: 'currentColor'
                    },
                        React.createElement('path', {
                            d: 'M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z'
                        })
                    )
                ),
                (settings.privacyMode || (settings.applyNSFWBlur && (channel.nsfw || channel.nsfw_))) && 
                React.createElement('div', {
                    className: 'ping-notification-hover-text'
                }, "Hover to unblur")
            ),
            React.createElement('div', { 
                className: "ping-notification-body",
                style: { 
                    flex: 1, 
                    marginTop: '12px',
                    marginBottom: '8px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    maxHeight: '300px',
                    overflowY: 'hidden',
                    transition: 'overflow-y 0.2s ease',
                    whiteSpace: 'pre-wrap',
                    '&:hover': {
                        overflowY: 'auto'
                    }
                },
                onMouseEnter: (e) => {
                    e.currentTarget.style.overflowY = 'auto';
                },
                onMouseLeave: (e) => {
                    e.currentTarget.style.overflowY = 'hidden';
                }
            },
                message.messageReference && !message.flags && React.createElement('div', {
                    style: {
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '4px',
                        fontSize: '0.75em',
                        color: 'var(--text-muted)',
                        paddingLeft: '16px',
                        position: 'relative'
                    }
                },
                    React.createElement('div', {
                        style: {
                            position: 'absolute',
                            left: '0',
                            top: '50%',
                            width: '12px',
                            height: '12px',
                            borderLeft: '2px solid var(--interactive-muted)',
                            borderTop: '2px solid var(--interactive-muted)',
                            borderTopLeftRadius: '6px',
                            transform: 'translateY(-50%)'
                        }
                    }),
                    React.createElement('span', {
                        style: {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }
                    }, 
                        "Replying to ",
                        React.createElement('span', {
                            style: {
                                color: 'var(--text-link)',
                                fontWeight: '500'
                            }
                        }, message.messageReference.author?.username || "message"),
                        ": ",
                        React.createElement('span', {
                            style: {
                                color: 'var(--text-muted)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                display: 'inline-block',
                                maxWidth: '180px'
                            }
                        }, message.messageReference.message?.content 
                            ? parse(message.messageReference.message.content
                                .replace(/```(?:[\w]*\n)?([^```]+)```/g, '$1')
                                .replace(/`([^`]+)`/g, '$1')
                                .replace(/\n/g, ' ')
                                .trim(), true, { channelId: channel.id })
                            : "")
                    )
                ),
                React.createElement('span', null,
                    parse(message.content || '', true, { channelId: channel.id, allowLinks: true }),
                    message.editedTimestamp && React.createElement('span', {
                        style: {
                            fontSize: '0.625rem',
                            color: 'var(--text-muted)',
                            marginLeft: '3px'
                        }
                    }, '(edited)')
                ),
                React.createElement('div', {
                    style: {
                        maxWidth: '100%',
                        maxHeight: '300px',
                        overflow: 'hidden',
                    },
                    onClick: (e) => e.stopPropagation()
                },
                    React.createElement(MessageAccessories, {
                        message: message,
                        channel: channel,
                        inlineEmbedMedia: true,
                        onImageLoad: onImageLoad,
                        renderEmbeds: true,
                        renderAttachments: true,
                        attachmentPosition: 0,
                        compact: false,
                        isHighlighted: false,
                        inlineAttachmentMedia: true,
                        autoplayGifs: true,
                        hideMedia: false,
                        forceAutoplay: true,
                        shouldRenderEmbed: true,
                        canDeleteAttachments: false,
                        gifAutoPlay: true,
                        onMediaItemContextMenu: (e) => e.preventDefault(),
                        className: "ping-notification-media"
                    })
                )
            ),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    width: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                }
            }),
            React.createElement('div', { 
                style: { 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    height: '4px',
                    width: `${progress}%`,
                    backgroundColor: progressColorString,
                    transition: 'width 0.1s linear, background-color 0.5s ease',
                    zIndex: 1,
                }
            }),
            React.createElement('div', {
                style: {
                    position: 'absolute',
                    bottom: '8px',
                    right: '12px',
                    fontSize: '12px',
                    color: progressColorString,
                    transition: 'color 0.5s ease',
                    fontWeight: 'bold',
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                    padding: '2px 6px',
                    borderRadius: '10px'
                }
            }, `${Math.round(remainingTime / 1000)}s`),
            settings.privacyMode && React.createElement('div', {
                className: 'ping-notification-hover-text'
            }, "Hover to unblur")
        );
    }

    function SettingsPanel({ settings, onSettingsChange }) {
        const [localSettings, setLocalSettings] = React.useState(settings);

        const handleChange = (key, value) => {
            const newSettings = { ...localSettings, [key]: value };
            setLocalSettings(newSettings);
            onSettingsChange(newSettings);
        };

        const Switch = ({ label, checked, onChange }) => (
            React.createElement('div', { className: 'pingNotification-setting' },
                React.createElement('label', { className: 'pingNotification-label' }, label),
                React.createElement('div', { 
                    className: `pingNotification-switch ${checked ? 'checked' : ''}`,
                    onClick: () => onChange(!checked)
                },
                    React.createElement('div', { className: 'pingNotification-switch-slider' })
                )
            )
        );

        return React.createElement('div', { className: 'pingNotification-settings' },
            React.createElement('div', { className: 'pingNotification-section' },
                React.createElement('h3', { className: 'pingNotification-section-title' }, "General Settings"),

                React.createElement('div', { className: 'pingNotification-setting' },
                    React.createElement('label', { className: 'pingNotification-label' }, "Notification Duration"),
                    React.createElement('div', { className: 'pingNotification-duration' },
                        React.createElement('input', {
                            type: 'range',
                            min: 1,
                            max: 60,
                            value: localSettings.duration / 1000,
                            onChange: (e) => handleChange('duration', e.target.value * 1000),
                            className: 'pingNotification-slider'
                        }),
                        React.createElement('input', {
                            type: 'number',
                            min: 1,
                            max: 60,
                            value: localSettings.duration / 1000,
                            onChange: (e) => handleChange('duration', Math.min(60, Math.max(1, parseInt(e.target.value))) * 1000),
                            className: 'pingNotification-duration-input'
                        }),
                        React.createElement('span', { className: 'pingNotification-duration-label' }, "seconds")
                    )
                ),

                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement('div', { className: 'pingNotification-setting' },
                    React.createElement('label', { className: 'pingNotification-label' }, "Popup Location"),
                    React.createElement('select', {
                        value: localSettings.popupLocation,
                        onChange: (e) => handleChange('popupLocation', e.target.value),
                        className: 'pingNotification-select'
                    },
                        React.createElement('option', { value: "topLeft" }, "Top Left"),
                        React.createElement('option', { value: "topRight" }, "Top Right"),
                        React.createElement('option', { value: "bottomLeft" }, "Bottom Left"),
                        React.createElement('option', { value: "bottomRight" }, "Bottom Right")
                    )
                )
            ),

            React.createElement('div', { className: 'pingNotification-section' },
                React.createElement('h3', { className: 'pingNotification-section-title' }, "Appearance"),

                React.createElement(Switch, {
                    label: "Privacy Mode",
                    checked: localSettings.privacyMode,
                    onChange: (value) => handleChange('privacyMode', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Blur Content from NSFW Channels",
                    checked: localSettings.applyNSFWBlur,
                    onChange: (value) => handleChange('applyNSFWBlur', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Allow Notifications in Current Channel",
                    checked: localSettings.allowNotificationsInCurrentChannel,
                    onChange: (value) => handleChange('allowNotificationsInCurrentChannel', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Colored Senders Usernames",
                    checked: localSettings.coloredUsernames,
                    onChange: (value) => handleChange('coloredUsernames', value)
                }),
                React.createElement('div', { className: 'pingNotification-separator' }),

                React.createElement(Switch, {
                    label: "Show Senders Nicknames Instead of Usernames",
                    checked: localSettings.showNicknames,
                    onChange: (value) => handleChange('showNicknames', value)
                })
            )
        );
    }
