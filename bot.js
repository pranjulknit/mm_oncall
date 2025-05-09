require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const {
  getUserById,
  setAdmin,
  setLead,
  addUser,
  isAdmin,
  isLead,
  getTeamMembers,
  getTeamMembersWithRoles,
  setRoster,
  getRoster,
  getTeamRoster,
  notifyAdminsLeads,
  createCriticalIncident,
  checkIncidentResponse,
  markIncidentResponded,
  escalateIncident,
  getLeadByTeam
} = require('./src/db/db');
const { generateCalendarKeyboard, generateTeamMemberKeyboard } = require('./src/roster/roster');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const AUTHORIZED_TELEGRAM_ID = parseInt(process.env.AUTHORIZED_TELEGRAM_ID);

// Session storage
const rosterSessions = {};
const incidentSessions = {};

// /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || 'Unknown';

  const user = await getUserById(userId);
  if (user && user.verified) {
    const roles = user.roles && user.roles.length ? user.roles.join(', ') : 'none';
    await bot.sendMessage(
      chatId,
      `✅ Welcome back, ${user.full_name}! Your roles: ${roles}${user.team ? ` in ${user.team}` : ''}.`
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    `Your Telegram ID is: ${userId}\nPlease share this ID with your admin or lead to get registered.`
  );

  const adminLeadIds = await notifyAdminsLeads(userId, username);
  for (const leadId of adminLeadIds) {
    await bot.sendMessage(
      leadId,
      `🔔 New user wants to join: ${username}, Telegram ID: ${userId}`
    );
  }
});

// /setadmin
bot.onText(/\/setadmin (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1].split(' ');

  if (userId !== AUTHORIZED_TELEGRAM_ID) {
    await bot.sendMessage(chatId, '❌ Unauthorized: Only the designated admin can use this command.');
    return;
  }

  if (args.length < 3) {
    await bot.sendMessage(
      chatId,
      '⚠️ Usage: /setadmin <telegram_id> <phone_number> <full_name>\nExample: /setadmin 123456789 +912345678901 Suresh Admin'
    );
    return;
  }

  const telegramId = args[0];
  const phoneNumber = args[1];
  const fullName = args.slice(2).join(' ');

  if (!/^\d+$/.test(telegramId)) {
    await bot.sendMessage(chatId, '❌ Invalid Telegram ID format. Use numeric ID.');
    return;
  }

  if (!phoneNumber.startsWith('+') || !/^\+\d+$/.test(phoneNumber)) {
    await bot.sendMessage(chatId, '❌ Invalid phone number format. Use format: +1234567890');
    return;
  }

  try {
    await setAdmin(telegramId, phoneNumber, fullName);
    await bot.sendMessage(chatId, `✅ Admin profile set for ${fullName} (${phoneNumber}).`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /setlead
bot.onText(/\/setlead (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1].split(' ');

  if (!(await isAdmin(userId))) {
    await bot.sendMessage(chatId, '❌ Only admins can set leads.');
    return;
  }

  if (args.length < 4) {
    await bot.sendMessage(
      chatId,
      '⚠️ Usage: /setlead <telegram_id> <phone_number> <full_name> <team>\nExample: /setlead 111222333 +919876543210 Jane Doe linux'
    );
    return;
  }

  const telegramId = args[0];
  const phoneNumber = args[1];
  const team = args[args.length - 1].toLowerCase();
  const fullName = args.slice(2, -1).join(' ');

  if (!/^\d+$/.test(telegramId)) {
    await bot.sendMessage(chatId, '❌ Invalid Telegram ID format. Use numeric ID.');
    return;
  }

  if (!phoneNumber.startsWith('+') || !/^\+\d+$/.test(phoneNumber)) {
    await bot.sendMessage(chatId, '❌ Invalid phone number format.');
    return;
  }

  try {
    await setLead(telegramId, phoneNumber, fullName, team);
    await bot.sendMessage(chatId, `✅ Lead ${fullName} set for team ${team}.`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /adduser
bot.onText(/\/adduser (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const args = match[1].split(' ');

  if (!(await isAdmin(userId) || await isLead(userId))) {
    await bot.sendMessage(chatId, '❌ Only admins or leads can add users.');
    return;
  }

  if (args.length < 4) {
    await bot.sendMessage(
      chatId,
      '⚠️ Usage: /adduser <telegram_id> <phone_number> <full_name> <team>\nExample: /adduser 987654321 +919876543201 Ramesh linux'
    );
    return;
  }

  const telegramId = args[0];
  const phoneNumber = args[1];
  const team = args[args.length - 1].toLowerCase();
  const fullName = args.slice(2, -1).join(' ');

  if (!/^\d+$/.test(telegramId)) {
    await bot.sendMessage(chatId, '❌ Invalid Telegram ID format. Use numeric ID.');
    return;
  }

  if (!phoneNumber.startsWith('+') || !/^\+\d+$/.test(phoneNumber)) {
    await bot.sendMessage(chatId, '❌ Invalid phone number format.');
    return;
  }

  try {
    await addUser(telegramId, phoneNumber, fullName, team);
    await bot.sendMessage(chatId, `✅ Added ${fullName} to team ${team}.`);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /getroles <telegram_id>
bot.onText(/\/getroles (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const telegramId = match[1];

  if (!(await isAdmin(userId) || await isLead(userId))) {
    await bot.sendMessage(chatId, '❌ Only admins or leads can view roles.');
    return;
  }

  if (!/^\d+$/.test(telegramId)) {
    await bot.sendMessage(chatId, '❌ Invalid Telegram ID format. Use numeric ID.');
    return;
  }

  try {
    const user = await getUserById(telegramId);
    if (!user) {
      await bot.sendMessage(chatId, `❌ No user found with Telegram ID: ${telegramId}`);
      return;
    }
    const roles = user.roles && user.roles.length ? user.roles.join(', ') : 'none';
    await bot.sendMessage(
      chatId,
      `👤 User: ${user.full_name}\n` +
      `📱 Phone: ${user.phone_number}\n` +
      `💼 Roles: ${roles}\n` +
      `🏢 Team: ${user.team || 'None'}`
    );
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /allroles @team_name
bot.onText(/\/allroles @(\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const team = match[1].toLowerCase();

  if (!(await isAdmin(userId) || await isLead(userId))) {
    await bot.sendMessage(chatId, '❌ Only admins or leads can view team roles.');
    return;
  }

  try {
    const members = await getTeamMembersWithRoles(team);
    if (!members.length) {
      await bot.sendMessage(chatId, `❌ No members found for team ${team}.`);
      return;
    }

    let response = `👥 Team ${team} Members:\n\n`;
    for (const member of members) {
      const roles = member.roles && member.roles.length ? member.roles.join(', ') : 'none';
      response += `👤 Name: ${member.full_name}\n` +
                 `📱 Phone: ${member.phone_number}\n` +
                 `💼 Roles: ${roles}\n` +
                 `🏢 Team: ${member.team}\n\n`;
    }
    await bot.sendMessage(chatId, response);
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /setroster
bot.onText(/\/setroster/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isLead(userId))) {
    await bot.sendMessage(chatId, '❌ Only leads can set rosters.');
    return;
  }

  if (await isAdmin(userId)) {
    await bot.sendMessage(chatId, '❌ Admins cannot set rosters. Please use a lead account.');
    return;
  }

  const user = await getUserById(userId);
  const team = user.team;
  if (!team) {
    await bot.sendMessage(chatId, '❌ You are not assigned to any team.');
    return;
  }

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  rosterSessions[userId] = { team, selectedDates: [], step: 'select_dates', year, month };
  await bot.sendMessage(
    chatId,
    `📅 Select dates for ${team} roster:`,
    {
      reply_markup: {
        inline_keyboard: generateCalendarKeyboard(year, month)
      }
    }
  );
});

// Handle callback queries
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;

  // Roster session
  const rosterSession = rosterSessions[userId];
  if (rosterSession) {
    if (data.startsWith('select_date:')) {
      const date = data.split(':')[1];
      if (!rosterSession.selectedDates.includes(date)) {
        rosterSession.selectedDates.push(date);
      } else {
        rosterSession.selectedDates = rosterSession.selectedDates.filter(d => d !== date);
      }
      await bot.editMessageText(
        `📅 Select dates for ${rosterSession.team} roster:\nSelected: ${rosterSession.selectedDates.join(', ') || 'None'}`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: generateCalendarKeyboard(rosterSession.year, rosterSession.month)
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
    }

    if (data.startsWith('prev_month:') || data.startsWith('next_month:')) {
      const [action, year, month] = data.split(':');
      let newYear = parseInt(year);
      let newMonth = parseInt(month) + (action === 'next_month' ? 1 : -1);
      if (newMonth < 0) {
        newMonth = 11;
        newYear--;
      } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
      }
      rosterSession.year = newYear;
      rosterSession.month = newMonth;
      await bot.editMessageText(
        `📅 Select dates for ${rosterSession.team} roster:\nSelected: ${rosterSession.selectedDates.join(', ') || 'None'}`,
        {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: generateCalendarKeyboard(newYear, newMonth)
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
    }

    if (data === 'confirm_dates') {
      if (!rosterSession.selectedDates.length) {
        await bot.answerCallbackQuery(query.id, { text: 'Please select at least one date.' });
        return;
      }
      rosterSession.step = 'select_primary';
      const keyboard = await generateTeamMemberKeyboard(rosterSession.team);
      await bot.sendMessage(
        chatId,
        `Select primary user for ${rosterSession.team} roster on ${rosterSession.selectedDates.join(', ')}:`,
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
    }

    if (data.startsWith('select_member:') && rosterSession.step === 'select_primary') {
      rosterSession.primaryId = data.split(':')[1];
      rosterSession.step = 'select_secondary';
      const keyboard = await generateTeamMemberKeyboard(rosterSession.team);
      await bot.sendMessage(
        chatId,
        `Select secondary user for ${rosterSession.team} roster on ${rosterSession.selectedDates.join(', ')}:`,
        {
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      await bot.answerCallbackQuery(query.id);
    }

    if (data.startsWith('select_member:') && rosterSession.step === 'select_secondary') {
      rosterSession.secondaryId = data.split(':')[1];
      try {
        for (const date of rosterSession.selectedDates) {
          await setRoster(rosterSession.team, date, rosterSession.primaryId, rosterSession.secondaryId);
        }
        await bot.sendMessage(
          chatId,
          `✅ Roster set for ${rosterSession.team} on ${rosterSession.selectedDates.join(', ')}.\n` +
          `Primary: ${(await getUserById(rosterSession.primaryId)).full_name}\n` +
          `Secondary: ${(await getUserById(rosterSession.secondaryId)).full_name}`
        );
        delete rosterSessions[userId];
      } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
      }
      await bot.answerCallbackQuery(query.id);
    }
  }

  // Critical incident acknowledge
  if (data.startsWith('ack:')) {
    const incidentId = data.split(':')[1];
    const incident = await checkIncidentResponse(incidentId);
    if (incident && !incident.primary_responded && incident.primary_id == userId) {
      incidentSessions[userId] = { incidentId, chatId: incident.chat_id };
      await markIncidentResponded(incidentId);
      await bot.sendMessage(
        incident.chat_id,
        `✅ Issue "${incident.issue}" acknowledged by ${(await getUserById(userId)).full_name} for team ${incident.team}.`
      );
      const lead = await getUserById(incident.lead_id);
      await bot.sendMessage(
        incident.lead_id,
        `✅ Primary (${(await getUserById(incident.primary_id)).full_name}) acknowledged issue: ${incident.issue} for ${incident.team}.`
      );
      delete incidentSessions[userId];
    } else {
      await bot.sendMessage(
        chatId,
        `❌ Cannot acknowledge: You are not the primary or issue already acknowledged.`
      );
    }
    await bot.answerCallbackQuery(query.id);
  }
});

// /viewroster

bot.onText(/\/viewroster\s+@(\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const team = match[1].toLowerCase();

  // Send loading message
  const loadingMessage = await bot.sendMessage(
    chatId,
    `🔄 Fetching rosters for ${team}, please wait...`
  );

  try {
    const rosters = await getTeamRoster(team);
    // Delete loading message
    

    if (!rosters.length) {
      await bot.sendMessage(chatId, `❌ No roster found for ${team}.`);
      return;
    }
    let response = `📅 Rosters for ${team}:\n\n`;
    
    for (const roster of rosters) {
      const primary = await getUserById(roster.primary_id);
      const secondary = await getUserById(roster.secondary_id);
      const primaryLink = primary.phone_number
        ? `https://t.me/+${primary.phone_number}`
        : 'No phone number';
      const secondaryLink = secondary.phone_number
        ? `https://t.me/+${secondary.phone_number}`
        : 'No phone number';
      response += `🗓️ Date: ${roster.date}\n` +
                 `👤 Primary: ${primary.full_name}\n` +
                 `📱 Phone: ${primary.phone_number || 'N/A'}\n` +
                 `🔗 Link: ${primaryLink}\n` +
                 `👤 Secondary: ${secondary.full_name}\n` +
                 `📱 Phone: ${secondary.phone_number || 'N/A'}\n` +
                 `🔗 Link: ${secondaryLink}\n\n`;
    }
    await bot.deleteMessage(chatId, loadingMessage.message_id);
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  } catch (error) {
    // Delete loading message on error
    await bot.deleteMessage(chatId, loadingMessage.message_id);
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

// /todayroster
bot.onText(/\/todayroster\s+@(\w+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const team = match[1].toLowerCase();

  // Send loading message
  const loadingMessage = await bot.sendMessage(
    chatId,
    `🔄 Fetching today's roster for ${team}, please wait...`
  );

  try {
    const today = new Date().toISOString().split('T')[0];
    const roster = await getRoster(team, today);
    // Delete loading message
    

    if (!roster) {
      await bot.sendMessage(chatId, `❌ No roster found for ${team} today.`);
      await bot.deleteMessage(chatId, loadingMessage.message_id);
      return;
    }
    const primary = await getUserById(roster.primary_id);
    const secondary = await getUserById(roster.secondary_id);
    
    const primaryLink = primary.phone_number
      ? `https://t.me/+${primary.phone_number}`
      : 'No phone number';
    const secondaryLink = secondary.phone_number
      ? `https://t.me/+${secondary.phone_number}`
      : 'No phone number';


    await bot.deleteMessage(chatId, loadingMessage.message_id);
    await bot.sendMessage(
      chatId,
      `📅 Roster for ${team} on ${today}:\n` +
      `Primary: ${primary.full_name} (${primary.phone_number || 'N/A'})\n` +
      `Link: ${primaryLink}\n` +
      `Secondary: ${secondary.full_name} (${secondary.phone_number || 'N/A'})\n` +
      `Link: ${secondaryLink}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    // Delete loading message on error
    await bot.deleteMessage(chatId, loadingMessage.message_id);
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});



// /critical
bot.onText(/\/critical\s+@(\w+)\s+(.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const team = match[1].toLowerCase();
  const issue = match[2];

  try {
    const today = new Date().toISOString().split('T')[0];
    const roster = await getRoster(team, today);
    if (!roster) {
      await bot.sendMessage(chatId, `❌ No roster found for ${team} today.`);
      return;
    }

    const primary = await getUserById(roster.primary_id);
    const secondary = await getUserById(roster.secondary_id);
    const lead = await getLeadByTeam(team);
    if (!primary || !secondary || !lead) {
      await bot.sendMessage(chatId, '❌ Primary, secondary, or lead not found.');
      return;
    }

    if (!primary.phone_number || !secondary.phone_number || !lead.phone_number) {
      await bot.sendMessage(chatId, '❌ Phone number missing for primary, secondary, or lead.');
      return;
    }

    const leadLink = lead.phone_number ? `https://t.me/+${lead.phone_number}` : 'No phone number';
    const incidentId = await createCriticalIncident(team, issue, roster.primary_id, roster.secondary_id, lead.telegram_id, chatId);

    // Notify same chat
    const primaryLink = primary.phone_number ? `https://t.me/+${primary.phone_number}` : 'No phone number';
    const secondaryLink = secondary.phone_number ? `https://t.me/+${secondary.phone_number}` : 'No phone number';
    await bot.sendMessage(
      chatId,
      `🚨 Critical Issue Reported: ${issue}\n` +
      `Team: ${team}\n` +
      `Primary: ${primary.full_name} (${primaryLink})\n` +
      `Secondary: ${secondary.full_name} (${secondaryLink})\n` +
      `Lead: ${lead.full_name} (${leadLink})\n` +
      `Status: Pending`
    );

    // Notify primary (high priority)
    await bot.sendMessage(
      roster.primary_id,
      `🚨 Critical Issue: ${issue}\nYou are on-call for ${team} today. Respond immediately in this chat.\nContact lead: ${leadLink}`,
      {
        priority: 'high',
        reply_markup: {
          inline_keyboard: [[{ text: 'Acknowledge', callback_data: `ack:${incidentId}` }]]
        }
      }
    );

    // Notify primary (after 60 seconds)
    setTimeout(async () => {
      const incident = await checkIncidentResponse(incidentId);
      if (incident && !incident.primary_responded) {
        await bot.sendMessage(
          roster.primary_id,
          `🚨 Reminder: Critical Issue: ${issue}\nRespond immediately .\n Or Contact lead: ${leadLink}`,
          {
            priority: 'high',
            reply_markup: {
              inline_keyboard: [[{ text: 'Acknowledge', callback_data: `ack:${incidentId}` }]]
            }
          }
        );
        await bot.sendMessage(
          chatId,
          `🔔 Reminder sent to primary (${primary.full_name}) for issue: ${issue}. Status: Pending`
        );
      }
    }, 60000);

    // Check for response after 5 minutes
    setTimeout(async () => {
      const incident = await checkIncidentResponse(incidentId);
      if (incident && !incident.primary_responded) {
        await escalateIncident(incidentId);
        await bot.sendMessage(
          roster.secondary_id,
          `🚨 Primary not responding for Critical Issue: ${issue}\nYou are secondary for ${team}. Respond immediately in this chat.\nContact lead: ${leadLink}`,
          { priority: 'high' }
        );
        await bot.sendMessage(
          chatId,
          `🔔 Escalated to secondary (${secondary.full_name}) for issue: ${issue}. Status: Pending`
        );
      }
    }, 5 * 60 * 1000);

    // Notify lead
    await bot.sendMessage(
      lead.telegram_id,
      `🔔 Critical Issue Reported: ${issue}\nTeam: ${team}\nPrimary: ${primary.full_name} (${primaryLink})\nSecondary: ${secondary.full_name} (${secondaryLink})`
    );

    await bot.sendMessage(
      chatId,
      `✅ Notified primary (${primary.full_name}) for ${team}. Escalation to secondary (${secondary.full_name}) if no response in 5 minutes.\nLead (${lead.full_name}) informed.`
    );
  } catch (error) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});


// /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  const commandsMessage = `
📖 *All Commands Overview*

Here's a comprehensive list of all bot commands with their details:

1. 🔄 **/start**
   - *Description*: Initializes the bot, registers new users, or welcomes verified users with their roles and team.
   - *Usage*: /start
   - *Who Can Use*: Anyone
   - *Example*: /start

2. 🔧 **/setadmin**
   - *Description*: Assigns a user as an admin. Restricted to the designated admin.
   - *Usage*: /setadmin <telegram_id> <phone_number> <full_name>
   - *Who Can Use*: Designated Admin (AUTHORIZED_TELEGRAM_ID)
   - *Example*: /setadmin 123456789 +912345678901 Suresh Admin

3. 🔧 **/setlead**
   - *Description*: Assigns a user as a team lead for a specific team.
   - *Usage*: /setlead <telegram_id> <phone_number> <full_name> <team>
   - *Who Can Use*: Admins
   - *Example*: /setlead 111222333 +919876543210 Jane Doe linux

4. 👥 **/adduser**
   - *Description*: Adds a user to a team with their Telegram ID, phone number, and name.
   - *Usage*: /adduser <telegram_id> <phone_number> <full_name> <team>
   - *Who Can Use*: Admins, Leads
   - *Example*: /adduser 987654321 +919876543201 Ramesh linux

5. 🔍 **/getroles**
   - *Description*: Displays roles, phone number, and team details for a specific user by Telegram ID.
   - *Usage*: /getroles <telegram_id>
   - *Who Can Use*: Admins, Leads
   - *Example*: /getroles 123456789

6. 👥 **/allroles**
   - *Description*: Lists all members of a team with their roles, phone numbers, and team details.
   - *Usage*: /allroles @team_name
   - *Who Can Use*: Admins, Leads
   - *Example*: /allroles @linux

7. 📅 **/setroster**
   - *Description*: Sets the on-call roster for a team by selecting dates and assigning primary/secondary users.
   - *Usage*: /setroster
   - *Who Can Use*: Leads
   - *Example*: /setroster (follow interactive prompts)

8. 📅 **/viewroster**
   - *Description*: Displays all rosters for a team, including primary/secondary names, phone numbers, and Telegram deeplinks.
   - *Usage*: /viewroster @team_name
   - *Who Can Use*: Anyone
   - *Example*: /viewroster @linux

9. 📅 **/todayroster**
   - *Description*: Shows today's roster for a team with primary/secondary names, phone numbers, and Telegram deeplinks.
   - *Usage*: /todayroster @team_name
   - *Who Can Use*: Anyone
   - *Example*: /todayroster @linux

10. 🚨 **/critical**
    - *Description*: Reports a critical incident, notifies the on-call team, and escalates if no response.
    - *Usage*: /critical @team_name <issue>
    - *Who Can Use*: Anyone
    - *Example*: /critical @linux w16 down

11. ❓ **/help**
    - *Description*: Displays a concise list of all commands with basic details.
    - *Usage*: /help
    - *Who Can Use*: Anyone
    - *Example*: /help



💡 *Pro Tip*: Phone numbers must start with ‘+’ (e.g., +919876543210). For loud notifications, configure a loud sound in Telegram settings for the bot’s chat.

For support, contact your admin or lead.
  `;
  await bot.sendMessage(chatId, commandsMessage, { parse_mode: 'Markdown' });
});




// Error Handling
bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('Bot is running...');