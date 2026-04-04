const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const ROLE_ID = "1489806905588322304";
const ADMIN_ROLE_ID = "1489803274637934763";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ── Register slash commands on startup ──
client.once('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);

  const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Open CeraHub Control Panel'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
      .addUserOption(o => o.setName('user').setDescription('User to unban').setRequired(true)),
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
    // Slash commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') return handlePanel(interaction);
      if (interaction.commandName === 'ban') return handleBan(interaction);
      if (interaction.commandName === 'unban') return handleUnban(interaction);
    }

    // Button clicks
    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id === 'redeem_key') return showRedeemModal(interaction);
      if (id === 'get_script') return handleGetScript(interaction);
      if (id === 'get_role') return handleGetRole(interaction);
      if (id === 'reset_hwid') return handleResetHwid(interaction);
      if (id === 'get_stats') return handleGetStats(interaction);
    }

    // Modal submit
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

// ── Panel ──
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

// ── Redeem Key Modal ──
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
    .select('*').eq('key', keyInput).eq('is_active', true).maybeSingle();

  if (!keyData) return interaction.reply({ content: '❌ Invalid or expired key.', ephemeral: true });
  if (!keyData.lootlabs_completed) return interaction.reply({ content: '❌ Key not activated yet. Complete all 3 steps first.', ephemeral: true });
  if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) return interaction.reply({ content: '❌ Key has expired.', ephemeral: true });
  if (keyData.discord_user_id && keyData.discord_user_id !== userId) return interaction.reply({ content: '❌ This key belongs to another user.', ephemeral: true });

  await supabase.from('keys').update({ discord_user_id: userId }).eq('id', keyData.id);
  const expiry = keyData.expires_at ? `<t:${Math.floor(new Date(keyData.expires_at).getTime() / 1000)}:R>` : 'Never';
  await interaction.reply({ content: `✅ Key redeemed!\n\n🔑 Key: \`${keyData.key}\`\n⏰ Expires: ${expiry}`, ephemeral: true });
}

// ── Get Script ──
async function handleGetScript(interaction) {
  const userId = interaction.user.id;
  const { data: banned } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();
  if (banned) return interaction.reply({ content: '❌ You are banned.', ephemeral: true });

  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true).eq('lootlabs_completed', true)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No active key found. Redeem a key first.', ephemeral: true });
  const k = keys[0];
  if (k.expires_at && new Date(k.expires_at) < new Date()) return interaction.reply({ content: '❌ Your key has expired.', ephemeral: true });

  const scriptUrl = `https://ciybdtgrarvjkpphuqbn.supabase.co/functions/v1/cl`;
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

// ── Reset HWID ──
async function handleResetHwid(interaction) {
  const userId = interaction.user.id;
  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No key found. Redeem a key first.', ephemeral: true });
  await supabase.from('keys').update({ hwid: null }).eq('id', keys[0].id);
  await interaction.reply({ content: '✅ HWID reset. It will be re-assigned on next execution.', ephemeral: true });
}

// ── Get Stats ──
async function handleGetStats(interaction) {
  const userId = interaction.user.id;
  const { data: keys } = await supabase.from('keys')
    .select('*').eq('discord_user_id', userId).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1);

  if (!keys?.length) return interaction.reply({ content: '❌ No key found. Redeem a key first.', ephemeral: true });
  const k = keys[0];
  const { data: banned } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();

  const expiry = k.expires_at ? `<t:${Math.floor(new Date(k.expires_at).getTime() / 1000)}:R>` : 'Never';
  await interaction.reply({
    content: `📊 **Stats**\n\n**HWID:** ${k.hwid ? 'Assigned ✅' : 'Not set ⚠️'}\n**Key:** ||${k.key}||\n**Expires:** ${expiry}\n**Banned:** ${banned ? 'Yes ⛔' : 'No ✅'}\n**Roblox:** ${k.roblox_username || 'Unknown'}`,
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
