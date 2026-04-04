const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

// ── Config ──
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ciybdtgrarvjkpphuqbn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROLE_ID = '1489806905588322304';       // Role to give users
const ADMIN_ROLE_ID = '1489803274637934763'; // Admin role
const SCRIPT_URL = 'https://ciybdtgrarvjkpphuqbn.supabase.co/functions/v1/cl';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Discord Client ──
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ── Register Slash Commands ──
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

  const commands = [
    new SlashCommandBuilder().setName('panel').setDescription('Show the CeraHub control panel'),
    new SlashCommandBuilder().setName('ban').setDescription('Ban a user from CeraHub')
      .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true)),
    new SlashCommandBuilder().setName('unban').setDescription('Unban a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to unban').setRequired(true)),
  ];

  await rest.put(Routes.applicationCommands(APP_ID), { body: commands.map(c => c.toJSON()) });
  console.log('✅ Slash commands registered');
}

// ── Helpers ──
async function isBanned(userId) {
  const { data } = await supabase.from('banned_users').select('id').eq('discord_user_id', userId).maybeSingle();
  return !!data;
}

async function getUserKey(userId) {
  const { data } = await supabase.from('keys')
    .select('*')
    .eq('discord_user_id', userId)
    .eq('is_active', true)
    .eq('lootlabs_completed', true)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

async function getUserAnyKey(userId) {
  const { data } = await supabase.from('keys')
    .select('*')
    .eq('discord_user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

function isExpired(key) {
  return key.expires_at && new Date(key.expires_at) < new Date();
}

function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Never';
  return `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>`;
}

// ── Interaction Handlers ──

client.on('ready', async () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
  client.user.setActivity('CeraHub Key System', { type: 3 }); // WATCHING
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  try {
    // ── Slash Commands ──
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        const embed = new EmbedBuilder()
          .setTitle('⚔ CeraHub Control Panel')
          .setDescription('Click the buttons below to manage your key.')
          .setColor(0xc81e1e)
          .setFooter({ text: 'CeraHub Key System • v2.0' })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('redeem_key').setLabel('Redeem Key').setEmoji('🔑').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('get_script').setLabel('Get Script').setEmoji('📜').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('get_role').setLabel('Get Role').setEmoji('🎭').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('reset_hwid').setLabel('Reset HWID').setEmoji('⚙').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('get_stats').setLabel('Get Stats').setEmoji('📊').setStyle(ButtonStyle.Secondary),
        );

        return interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === 'ban') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        const { error } = await supabase.from('banned_users').upsert({
          discord_user_id: target.id,
          banned_by: interaction.user.id,
        }, { onConflict: 'discord_user_id' });

        if (error) return interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
        return interaction.reply({ content: `✅ <@${target.id}> has been banned from CeraHub.`, ephemeral: true });
      }

      if (interaction.commandName === 'unban') {
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
          return interaction.reply({ content: '❌ You don\'t have permission.', ephemeral: true });
        }
        const target = interaction.options.getUser('user');
        await supabase.from('banned_users').delete().eq('discord_user_id', target.id);
        return interaction.reply({ content: `✅ <@${target.id}> has been unbanned.`, ephemeral: true });
      }
    }

    // ── Button Clicks ──
    if (interaction.isButton()) {
      const userId = interaction.user.id;

      if (interaction.customId === 'redeem_key') {
        if (await isBanned(userId)) return interaction.reply({ content: '❌ You are banned.', ephemeral: true });

        const modal = new ModalBuilder()
          .setCustomId('modal_redeem_key')
          .setTitle('Redeem Key')
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId('key_input')
                .setLabel('Enter your key')
                .setPlaceholder('XXXXX-XXXXX-XXXXX-XXXXX')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(10)
                .setMaxLength(30)
            )
          );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'get_script') {
        if (await isBanned(userId)) return interaction.reply({ content: '❌ You are banned.', ephemeral: true });

        const key = await getUserKey(userId);
        if (!key) return interaction.reply({ content: '❌ No active key found. Redeem a key first.', ephemeral: true });
        if (isExpired(key)) return interaction.reply({ content: '❌ Your key has expired.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle('📜 Your Script')
          .setDescription(`Here is your script:`)
          .setColor(0xc81e1e)
          .addFields({
            name: 'Loadstring',
            value: `\`\`\`lua\nscript_key="${key.key}";\nloadstring(game:HttpGet("${SCRIPT_URL}"))()\n\`\`\``
          });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (interaction.customId === 'get_role') {
        try {
          const member = interaction.member;
          if (member.roles.cache.has(ROLE_ID)) {
            return interaction.reply({ content: `✅ You already have <@&${ROLE_ID}>!`, ephemeral: true });
          }
          await member.roles.add(ROLE_ID);
          return interaction.reply({ content: `✅ Role <@&${ROLE_ID}> has been assigned!`, ephemeral: true });
        } catch {
          return interaction.reply({ content: '❌ Failed to assign role. Bot may lack permissions.', ephemeral: true });
        }
      }

      if (interaction.customId === 'reset_hwid') {
        const key = await getUserAnyKey(userId);
        if (!key) return interaction.reply({ content: '❌ No key found. Redeem a key first.', ephemeral: true });

        await supabase.from('keys').update({ hwid: null }).eq('id', key.id);
        return interaction.reply({ content: '✅ Your HWID has been reset. It will be re-assigned on next script execution.', ephemeral: true });
      }

      if (interaction.customId === 'get_stats') {
        const key = await getUserAnyKey(userId);
        if (!key) return interaction.reply({ content: '❌ No key found. Redeem a key first.', ephemeral: true });

        const banned = await isBanned(userId);

        const embed = new EmbedBuilder()
          .setTitle('📊 Stats')
          .setColor(0xc81e1e)
          .addFields(
            { name: 'HWID Status', value: key.hwid ? 'Assigned ✅' : 'Not set ⚠️', inline: true },
            { name: 'Key', value: `||${key.key}||`, inline: true },
            { name: 'Expires At', value: formatExpiry(key.expires_at), inline: true },
            { name: 'Banned', value: banned ? 'Yes ⛔' : 'No ✅', inline: true },
            { name: 'Roblox User', value: key.roblox_username || 'Unknown', inline: true },
            { name: 'Activated', value: key.lootlabs_completed ? 'Yes ✅' : 'No ❌', inline: true },
          )
          .setFooter({ text: 'CeraHub Key System' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }

    // ── Modal Submit ──
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_redeem_key') {
        const userId = interaction.user.id;
        const keyInput = interaction.fields.getTextInputValue('key_input').trim();

        const { data: keyData } = await supabase.from('keys')
          .select('*').eq('key', keyInput).eq('is_active', true).maybeSingle();

        if (!keyData) return interaction.reply({ content: '❌ Invalid or inactive key.', ephemeral: true });
        if (!keyData.lootlabs_completed) return interaction.reply({ content: '❌ Key not activated yet. Complete all 3 work.ink steps first.', ephemeral: true });
        if (isExpired(keyData)) return interaction.reply({ content: '❌ Key has expired.', ephemeral: true });
        if (keyData.discord_user_id && keyData.discord_user_id !== userId) return interaction.reply({ content: '❌ This key belongs to another user.', ephemeral: true });

        await supabase.from('keys').update({ discord_user_id: userId }).eq('id', keyData.id);

        const embed = new EmbedBuilder()
          .setTitle('✅ Key Redeemed!')
          .setColor(0x00ff88)
          .addFields(
            { name: 'Key', value: `\`${keyData.key}\``, inline: true },
            { name: 'Expires', value: formatExpiry(keyData.expires_at), inline: true },
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    }
  } catch (err) {
    console.error('Interaction error:', err);
    const reply = { content: '❌ An error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// ── Start ──
if (!DISCORD_TOKEN) { console.error('❌ DISCORD_BOT_TOKEN not set!'); process.exit(1); }
if (!SUPABASE_KEY) { console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set!'); process.exit(1); }

client.login(DISCORD_TOKEN);
