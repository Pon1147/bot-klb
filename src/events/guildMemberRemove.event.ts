import { handleLeaveMemberRemove } from '../features/welcome/leave.event.js';

export const execute = handleLeaveMemberRemove;

export default {
  name: 'guildMemberRemove',
  once: false,
  execute: handleLeaveMemberRemove,
};
