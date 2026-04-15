const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const ROLE_ID = "1489806905588322304";
const ADMIN_ROLE_ID = "1489803274637934763";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const parts = [];
  for (let i = 0; i < 4; i++) {
    let seg = "";
    for (let j = 0; j < 5; j++) {
      seg += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(seg);
  }
  return parts.join("-");
}

function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 3600 * 1000;
  if (unit === 'd') return num * 86400 * 1000;
  return null;
}

// ── Register slash commands on startup ──
client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Open CeraHub Control Panel'),
    new SlashCommandBuilder().setName('privatpanel').setDescription('Open CeraHub Private Control Panel'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
      .addUserOption(o => o.setName('user').setDescription('User to unban').setRequired(true)),
    new SlashCommandBuilder().setName('whitelist').setDescription('Whitelist a user with a timed key')
      .addUserOption(o => o.setName('user').setDescription('User to whitelist').setRequired(true))
      .addStringOption(o => o.setName('time').setDescription('Duration (e.g. 1h, 6h, 12h, 1d, 7d, 30d)').setRequired(true)),
    new SlashCommandBuilder().setName('whitelistprivat').setDescription('Whitelist a user for private script')
      .addUserOption(o => o.setName('user').setDescription('User to whitelist').setRequired(true))
      .addStringOption(o => o.setName('time').setDescription('Duration (e.g. 1h, 6h, 12h, 1d, 7d, 30d)').setRequired(true)),
    new SlashCommandBuilder().setName('unwhitelist').setDescription('Remove whitelist (delete key) from a user')
      .addUserOption(o => o.setName('user').setDescription('User to unwhitelist').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Key type: standard or private').setRequired(true)
        .addChoices({ name: 'Standard', value: 'standard' }, { name: 'Private', value: 'private' })),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
      { body: commands.map(c => c.toJSON()) }
    );
    console.log('✅ Slash commands registered globally');
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }
});

// ── Interaction handler ──
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') return handlePanel(interaction);
      if (interaction.commandName === 'privatpanel') return handlePrivatPanel(interaction);
      if (interaction.commandName === 'ban') return handleBan(interaction);
      if (interaction.commandName === 'unban') return handleUnban(interaction);
      if (interaction.commandName === 'whitelist') return handleWhitelist(interaction, 'standard');
      if (interaction.commandName === 'whitelistprivat') return handleWhitelist(interaction, 'private');
      if (interaction.commandName === 'unwhitelist') return handleUnwhitelist(interaction);
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'redeem_key') return showRedeemModal(interaction);
      if (id === 'get_script') return handleGetScript(interaction, 'standard');
      if (id === 'get_role') return handleGetRole(interaction);
      if (id === 'reset_hwid') return handleResetHwid(interaction, 'standard');
      if (id === 'get_stats') return handleGetStats(interaction, 'standard');
      // Private panel buttons
      if (id === 'get_script_private') return handleGetScript(interaction, 'private');
      if (id === 'reset_hwid_private') return handleResetHwid(interaction, 'private');
      if (id === 'get_stats_private') return handleGetStats(interaction, 'private');
    }

    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId === 'modal_redeem_key') return handleModalRedeem(interaction);
    }
  } catch (err) {
    console.error('Error handling interaction:', err);
    const reply = { content: '❌ An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ── Standard Panel ──
async function handlePanel(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('redeem_key').setLabel('Redeem Key').setEmoji('🔑').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('get_script').setLabel('Get Script').setEmoji('📜').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('get_role').setLabel('Get Role').setEmoji('🎭').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('reset_hwid').setLabel('Reset HWID').setEmoji('⚙').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('get_stats').setLabel('Get Stats').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({ content: '**⚔ CeraHub Control Panel**\n\nClick the buttons below to manage your key.', components: [row] });
}

// ── Private Panel ──
async function handlePrivatPanel(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('get_script_private').setLabel('Get Script').setEmoji('📜').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('reset_hwid_private').setLabel('Reset HWID').setEmoji('⚙').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('get_stats_private').setLabel('Get Stats').setEmoji('📊').setStyle(ButtonStyle.Secondary),
  );
  await interaction.reply({ content: '**🔒 CeraHub Private Panel**\n\nOnly whitelisted users can use this panel.', components: [row] });
}

// ── Whitelist (supports both standard and private) ──
async function handleWhitelist(interaction, keyType) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
    return interaction.reply({ content: '❌ No permission.', ephemeral: true });

  const target = interaction.options.getUser('user');
  const timeStr = interaction.options.getString('time');
  const durationMs = parseDuration(timeStr);

  if (!durationMs) {
    return interaction.reply({ content: '❌ Invalid time format. Use e.g. `1h`, `6h`, `12h`, `1d`, `7d`, `30d`.', ephemeral: true });
  }

  const newKey = generateKey();
  const expiresAt = new Date(Date.now() + durationMs);

  const { error } = await supabase.from('keys').insert({
    key: newKey,
    discord_user_id: target.id,
    expires_at: expiresAt.toISOString(),
    lootlabs_completed: true,
    is_active: true,
    key_type: keyType,
  });

  if (error) {
    console.error('Whitelist insert error:', error);
    return interaction.reply({ content: '❌ Failed to create key.', ephemeral: true });
  }

  const expiry = `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>`;
  const label = keyType === 'private' ? 'Private' : 'Standard';
  const scriptFn = keyType === 'private' ? 'cl-private' : 'cl';
  const scriptUrl = `https://ciybdtgrarvjkpphuqbn.supabase.co/functions/v1/${scriptFn}`;
  const dmContent = `🎉 **You've been whitelisted on CeraHub (${label})!**\n\n🔑 **Key:** \`${newKey}\`\n⏰ **Expires:** ${expiry}\n\n📜 **Script:**\n\`\`\`lua\nscript_key="${newKey}";\nloadstring(game:HttpGet("${scriptUrl}"))()\n\`\`\``;

  try {
    await target.send(dmContent);
    await interaction.reply({ content: `✅ ${label} key created and sent to <@${target.id}> via DM.\n\n🔑 Key: \`${newKey}\`\n⏰ Expires: ${expiry}`, ephemeral: true });
  } catch {
    await interaction.reply({ content: `✅ ${label} key created but couldn't DM <@${target.id}>.\n\n🔑 Key: \`${newKey}\`\n⏰ Expires: ${expiry}`, ephemeral: true });
  }
}

// ── Unwhitelist (delete key) ──
async function handleUnwhitelist(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
    return interaction.reply({ content: '❌ No permission.', ephemeral: true });

  const target = interaction.options.getUser('user');
  const keyType = interaction.options.getString('type');

  const { data, error } = await supabase.from('keys')
    .delete()
    .eq('discord_user_id', target.id)
    .eq('key_type', keyType)
    .eq('is_active', true);

  if (error) {
    console.error('Unwhitelist error:', error);
    return interaction.reply({ content: '❌ Failed to remove key.', ephemeral: true });
  }

  const label = keyType === 'private' ? 'Private' : 'Standard';
  await interaction.reply({ content: `✅ All active ${label} keys for <@${target.id}> have been deleted.`, ephemeral: true });
}

// ── Redeem Key Modal (standard only) ──
async function showRedeemModal(interaction) {
  const userId = interaction.user.id;
  const { data: banned } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();
  if (banned) return interaction.reply({ content: '❌ You are banned.', ephemeral: true });

  const modal = new ModalBuilder().setCustomId('modal_redeem_key').setTitle('Redeem Key');
  const input = new TextInputBuilder().setCustomId('key_input').setLabel('Enter your key')
    .setStyle(TextInputStyle.Short).setPlaceholder('XXXXX-XXXXX-XXXXX-XXXXX').setRequired(true).setMinLength(10).setMaxLength(30);
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  await interaction.showModal(modal);
}

async function handleModalRedeem(interaction) {
  const userId = interaction.user.id;
  const keyInput = interaction.fields.getTextInputValue('key_input').trim();

  const { data: keyData } = await supabase.from('keys')
    .select('*').eq('key', keyInput).eq('is_active', true).eq('key_type', 'standard').maybeSingle();

  if (!keyData) return interaction.reply({ content: '❌ Invalid or expired key.', ephemeral: true });
  if (!keyData.lootlabs_completed) return interaction.reply({ content: '❌ Key not activated yet. Complete all 3 steps first.', ephemeral: true });
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return interaction.reply({ content: '❌ Key has expired.', ephemeral: true });
  if (keyData.discord_user_id && keyData.discord_user_id !== userId) return interaction.reply({ content: '❌ This key belongs to another user.', ephemeral: true });

  await supabase.from('keys').update({ discord_user_id: userId }).eq('id', keyData.id);
  const expiry = keyData.expires_at ? `<t:${Math.floor(new Date(keyData.expires_at).getTime() / 1000)}:R>` : 'Never';
  await interaction.reply({ content: `✅ Key redeemed!\n\n🔑 Key: \`${keyData.key}\`\n⏰ Expires: ${expiry}`, ephemeral: true });
}

// ── Get Script (supports both types) ──
async function handleGetScript(interaction, keyType) {
  const userId = interaction.user.id;
  const { data: banned } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();
  if (banned) return interaction.reply({ content: '❌ You are banned.', ephemeral: true });

  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true).eq('lootlabs_completed', true)
    .eq('key_type', keyType)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No active key found.', ephemeral: true });
  const k = keys[0];
  if (k.expires_at && new Date(k.expires_at) < new Date()) return interaction.reply({ content: '❌ Your key has expired.', ephemeral: true });

  const scriptFn = keyType === 'private' ? 'cl-private' : 'cl';
  const scriptUrl = `https://ciybdtgrarvjkpphuqbn.supabase.co/functions/v1/${scriptFn}`;
  await interaction.reply({ content: `📜 Here is your script:\n\`\`\`lua\nscript_key="${k.key}";\nloadstring(game:HttpGet("${scriptUrl}"))()\n\`\`\``, ephemeral: true });
}

// ── Get Role ──
async function handleGetRole(interaction) {
  try {
    await interaction.member.roles.add(ROLE_ID);
    await interaction.reply({ content: `✅ Role <@&${ROLE_ID}> assigned!`, ephemeral: true });
  } catch {
    await interaction.reply({ content: '❌ Failed to assign role. Check bot permissions.', ephemeral: true });
  }
}

// ── Reset HWID (supports both types) ──
async function handleResetHwid(interaction, keyType) {
  const userId = interaction.user.id;
  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true).eq('key_type', keyType)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No key found.', ephemeral: true });
  await supabase.from('keys').update({ hwid: null }).eq('id', keys[0].id);
  await interaction.reply({ content: '✅ HWID reset. It will be re-assigned on next execution.', ephemeral: true });
}

// ── Get Stats (supports both types) ──
async function handleGetStats(interaction, keyType) {
  const userId = interaction.user.id;
  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true).eq('key_type', keyType)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No key found.', ephemeral: true });
  const k = keys[0];
  const { data: banned } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();

  const expiry = k.expires_at ? `<t:${Math.floor(new Date(k.expires_at).getTime() / 1000)}:R>` : 'Never';
  const label = keyType === 'private' ? '🔒 Private' : '⚔ Standard';
  await interaction.reply({
    content: `📊 **${label} Stats**\n\n**HWID:** ${k.hwid ? 'Assigned ✅' : 'Not set ⚠️'}\n**Key:** ||${k.key}||\n**Expires:** ${expiry}\n**Banned:** ${banned ? 'Yes ⛔' : 'No ✅'}\n**Roblox:** ${k.roblox_username || 'Unknown'}`,
    ephemeral: true
  });
}

// ── Ban/Unban ──
async function handleBan(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
    return interaction.reply({ content: '❌ No permission.', ephemeral: true });

  const target = interaction.options.getUser('user');
  await supabase.from('banned_users').upsert({ discord_user_id: target.id, banned_by: interaction.user.id }, { onConflict: 'discord_user_id' });
  await interaction.reply({ content: `✅ <@${target.id}> has been banned.`, ephemeral: true });
}

async function handleUnban(interaction) {
  if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID))
    return interaction.reply({ content: '❌ No permission.', ephemeral: true });

  const target = interaction.options.getUser('user');
  await supabase.from('banned_users').delete().eq('discord_user_id', target.id);
  await interaction.reply({ content: `✅ <@${target.id}> has been unbanned.`, ephemeral: true });
}

client.login(process.env.DISCORD_BOT_TOKEN);
