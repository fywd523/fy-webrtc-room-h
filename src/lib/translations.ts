
export const translations = {
  en: {
    appName: 'ConnectWave',
    app_description: 'High-quality video meetings for everyone.',
    join_or_create_room: 'Join or Create a Room',
    create_new_room: 'Create a New Room',
    your_new_room_id: 'Your new room is ready:',
    join_this_room: 'Join This Room',
    or: 'Or',
    enter_room_id: 'Enter Room ID',
    join: 'Join',
    all_rights_reserved: 'All rights reserved',
    room_created_success: 'Room Created Successfully',
    room_id: 'Room ID',
    error_title: 'Error',
    room_id_required: 'Please enter a Room ID.',
    copied_to_clipboard: 'Copied to clipboard!',
    mute: 'Mute',
    unmute: 'Unmute',
    start_video: 'Start Video',
    stop_video: 'Stop Video',
    share_screen: 'Share Screen',
    stop_sharing: 'Stop Sharing',
    chat: 'Chat',
    leave_meeting: 'Leave Meeting',
    screen_sharing: 'Sharing Screen',
    type_message_placeholder: 'Type a message...',
    you: 'You',
    welcome_to_room: 'Welcome to the Room',
    name_prompt_description: 'Please enter your name to join the meeting. This name will be visible to other participants.',
    your_name_placeholder: 'Your name',
    join_meeting_button: 'Join Meeting',
    joining_meeting_loading: 'Joining the meeting, please wait...',
    invite_participants: 'Invite Participants',
    invitation_copied_title: 'Invitation Copied!',
    invitation_copied_description: 'Meeting invitation has been copied to your clipboard.',
    settings: 'Settings',
    invitation_message: `
Hello!

{inviter} has invited you to a ConnectWave meeting.
Time: {time}

Room ID: {roomId}
Join here: {link}

See you there!
`
  },
  zh: {
    appName: 'ConnectWave',
    app_description: '为每个人提供高质量的视频会议。',
    join_or_create_room: '加入或创建会议室',
    create_new_room: '创建新会议室',
    your_new_room_id: '您的新会议室已准备就绪：',
    join_this_room: '加入此会议室',
    or: '或',
    enter_room_id: '输入会议室ID',
    join: '加入',
    all_rights_reserved: '版权所有',
    room_created_success: '会议室创建成功',
    room_id: '会议室ID',
    error_title: '错误',
    room_id_required: '请输入会议室ID。',
    copied_to_clipboard: '已复制到剪贴板！',
    mute: '静音',
    unmute: '取消静音',
    start_video: '开启视频',
    stop_video: '关闭视频',
    share_screen: '共享屏幕',
    stop_sharing: '停止共享',
    chat: '聊天',
    leave_meeting: '离开会议',
    screen_sharing: '正在共享屏幕',
    type_message_placeholder: '输入消息...',
    you: '你',
    welcome_to_room: '欢迎加入会议室',
    name_prompt_description: '请输入您的名字以加入会议。这个名字将会对其他参会者可见。',
    your_name_placeholder: '您的名字',
    join_meeting_button: '加入会议',
    joining_meeting_loading: '正在加入会议室，请稍候...',
    invite_participants: '邀请参会者',
    invitation_copied_title: '已复制邀请信息！',
    invitation_copied_description: '会议邀请信息已复制到您的剪贴板。',
    settings: '设置',
    invitation_message: `
您好！

{inviter} 邀请您加入 ConnectWave 会议。
邀请时间：{time}

会议室ID: {roomId}
点击链接加入: {link}

期待您的加入！
`
  },
}

export type Translations = typeof translations.en;
