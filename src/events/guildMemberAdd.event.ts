import { handleWelcomeMemberAdd } from '../features/welcome/welcome.event.js';

export const execute = handleWelcomeMemberAdd;

export default {
  name: 'guildMemberAdd',
  once: false,
  execute: handleWelcomeMemberAdd,
};
