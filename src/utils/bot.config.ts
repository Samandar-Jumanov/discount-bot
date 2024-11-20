import { Telegraf, Markup } from "telegraf";
import { botService } from "@/api/bot/botService";
import { logger } from "@/server";

export interface IDiscount {
    id: string;
    branchId : string 
    dishName: string;
    dishImage: string;
    description: string;
    code: string;
    originalPrice: string;
    discountPrice: string;
    quantity: string;
    startTime: string;
    endTime: string;
    isActive: boolean;
    currency : string
    customer: Array<{
      id: string;
      telegramId: string;
    }>;
  }
  
  
// Validate bot token
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN must be provided!");
}

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

// Helper function to format restaurant discount information
const formatDiscountMessage = (discount: any) => {
    return `🏪 ${discount.restaurantName}\n` +
           `📍 ${discount.branchAddress}\n` +
           `🍽 ${discount.dishName}\n` +
           `💰 Original: ${discount.currency}${discount.originalPrice}\n` +
           `🏷 Discounted: ${discount.currency}${discount.discountPrice}\n` +
           `📝 Description: ${discount.description}\n` +
           `🎫 Code: ${discount.discountCode}\n` +
           `⏰ Valid until: ${new Date(discount.validUntil).toLocaleString()}\n` +
           `📦 Remaining: ${discount.quantity}\n` +
           `📏 Distance: ${discount.distanceKm}km\n`;
};

// Main menu keyboard
const mainMenuKeyboard = Markup.keyboard([
    ['🔍 Find Nearby Discounts'],
    ['ℹ️ My Profile', '❓ Help'],
    ['📝 How It Works']
]).resize();

// Help menu keyboard
const helpMenuKeyboard = Markup.keyboard([
    ['📍 Location Help', '🎫 Redemption Help'],
    ['⬅️ Back to Main Menu']
]).resize();

// Start command handler
bot.start(async (ctx) => {
    try {
        if (!ctx.from?.id) {
            throw new Error("Telegram ID not found");
        }

        ctx.reply("Started to prepare an account for you ")

        const response = await botService.createCustomer({
            telegramId: String(ctx.from.id)
        });

        const welcomeMessage = response.success
            ? "Welcome to the Restaurant Discount Bot! 🎉\n\n" +
              "Find amazing discounts at restaurants near you! Here's how to get started:\n\n" +
              "1️⃣ Click 'Find Nearby Discounts'\n" +
              "2️⃣ Share your location\n" +
              "3️⃣ Get instant access to exclusive deals!\n\n" +
              "What would you like to do?"
            : "Welcome back to the Restaurant Discount Bot! 🎉\n\n" +
              "Ready to discover new deals?\n\n" +
              "What would you like to do?";

        await ctx.reply(welcomeMessage, mainMenuKeyboard);

    } catch (error) {
        logger.error("Error in start handler:", error);
        await ctx.reply(
            "Sorry, I couldn't set up your account. Please try again later.",
            mainMenuKeyboard
        );
    }
});

// Handle main menu selections
bot.hears('🔍 Find Nearby Discounts', async (ctx) => {
    await ctx.reply(
        "Please share your location to find nearby discounts 📍",
        Markup.keyboard([
            Markup.button.locationRequest('📍 Share Location')
        ]).resize()
    );
});

bot.hears('ℹ️ My Profile', async (ctx) => {
    // Here you could add profile functionality, showing past redemptions etc.
    await ctx.reply(
        "🎫 Your Discount History\n\n" +
        "Feature coming soon! You'll be able to see:\n" +
        "- Past redemptions\n" +
        "- Favorite restaurants\n" +
        "- Savings history",
        Markup.keyboard([['⬅️ Back to Main Menu']]).resize()
    );
});

bot.hears('❓ Help', async (ctx) => {
    await ctx.reply(
        "What do you need help with?",
        helpMenuKeyboard
    );
});

bot.hears('📝 How It Works', async (ctx) => {
    await ctx.reply(
        "🌟 How to Use the Restaurant Discount Bot 🌟\n\n" +
        "1️⃣ Find Discounts:\n" +
        "   • Click 'Find Nearby Discounts'\n" +
        "   • Share your location\n" +
        "   • Browse available deals\n\n" +
        "2️⃣ Redeem Discounts:\n" +
        "   • Choose a discount you like\n" +
        "   • Send the discount code\n" +
        "   • Show confirmation to restaurant\n\n" +
        "3️⃣ Save Money:\n" +
        "   • Enjoy your discounted meal!\n" +
        "   • Rate your experience\n" +
        "   • Share with friends\n\n" +
        "Need more help? Click the Help button!",
        mainMenuKeyboard
    );
});

// Help menu handlers
bot.hears('📍 Location Help', async (ctx) => {
    await ctx.reply(
        "📍 How to Share Your Location:\n\n" +
        "1. Click 'Find Nearby Discounts'\n" +
        "2. Allow location access when prompted\n" +
        "3. Click 'Share Location' button\n\n" +
        "Note: Make sure location services are enabled on your device!",
        helpMenuKeyboard
    );
});

bot.hears('🎫 Redemption Help', async (ctx) => {
    await ctx.reply(
        "🎫 How to Redeem Discounts:\n\n" +
        "1. Find a discount you like\n" +
        "2. Copy or type the discount code\n" +
        "3. Send the code to this bot\n" +
        "4. Show the confirmation message to restaurant staff\n\n" +
        "Note: Codes are case-insensitive and can only be used once!",
        helpMenuKeyboard
    );
});

// Handle back to main menu
bot.hears('⬅️ Back to Main Menu', async (ctx) => {
    await ctx.reply(
        "Main Menu - What would you like to do?",
        mainMenuKeyboard
    );
});

// Location handler
bot.on("location", async (ctx) => {
    try {
        const location = ctx.message.location;
        if (!location) {
            throw new Error("Location data not provided");
        }

        const { latitude, longitude } = location;
        
        // Show "searching" message with loading animation
        const loadingMessage = await ctx.reply("🔍 Searching for nearby discounts...");

        const response = await botService.findNearByResutuarants({
            latitude: String(latitude),
            longitude: String(longitude)
        });

        // Delete loading message
        await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

        const data  = response.responseObject as  IDiscount[]  |  null

        if (response.success && data?.length) {
            if (data.length === 0) {
                await ctx.reply(
                    "😔 No active discounts found in your area.\n\n" +
                    "Try again later or search in a different location!",
                    mainMenuKeyboard
                );
                return;
            }

            // Send summary message
            await ctx.reply(
                `🎉 Found ${data.length} active discounts nearby!`,
                mainMenuKeyboard
            );

            // Send each discount with inline buttons
            for (const discount  of data) {
                await ctx.reply(
                    formatDiscountMessage(discount),
                    Markup.inlineKeyboard([
                        Markup.button.callback(`🎫 Redeem ${discount?.code}`, `redeem_${discount?.code}`),
                        Markup.button.callback('📌 Save for Later', `save_${discount?.code}`)
                    ])
                );
            }

        } else {
            await ctx.reply(
                response.message || "No discounts found in your area.",
                mainMenuKeyboard
            );
        }
    } catch (error) {
        logger.error("Error in location handler:", error);
        await ctx.reply(
            "Sorry, I couldn't fetch the discounts. Please try again later.",
            mainMenuKeyboard
        );
    }
});

// Handle redemption button clicks
bot.action(/redeem_(.+)/, async (ctx) => {
    try {
        if (!ctx.from?.id) {
            throw new Error("User ID not found");
        }

        const discountCode = ctx.match[1];
        const response = await botService.reedemCode(
            discountCode,
            String(ctx.from.id)
        );

        if (response.success && response.responseObject) {
            await ctx.reply(
                "✅ Discount successfully redeemed!\n\n" +
                formatDiscountMessage(response.responseObject) +
                "\n📱 Show this message to the restaurant staff.",
                mainMenuKeyboard
            );
        } else {
            await ctx.reply(
                "❌ " + (response.message || "Unable to redeem discount code."),
                mainMenuKeyboard
            );
        }
    } catch (error) {
        logger.error("Error in redemption handler:", error);
        await ctx.reply(
            "Sorry, I couldn't process the redemption. Please try again.",
            mainMenuKeyboard
        );
    }
});

// Handle save for later button clicks
bot.action(/save_(.+)/, async (ctx) => {
    // Here you could add functionality to save discounts for later
    await ctx.reply(
        "📝 Save for Later feature coming soon!\n" +
        "You'll be able to save your favorite discounts.",
        mainMenuKeyboard
    );
});

// Handle text messages (for discount codes)
bot.on("text", async (ctx) => {
    // Skip if it's a menu command
    if (ctx.message.text.startsWith('🔍') || 
        ctx.message.text.startsWith('ℹ️') || 
        ctx.message.text.startsWith('❓') || 
        ctx.message.text.startsWith('📝') || 
        ctx.message.text.startsWith('⬅️')) {
        return;
    }

    try {
        if (!ctx.from?.id) {
            throw new Error("User ID not found");
        }

        const discountCode = ctx.message.text.trim().toUpperCase();
        
        // Basic validation
        if (discountCode.length < 4 || discountCode.length > 20) {
            await ctx.reply(
                "That doesn't look like a valid discount code. Need help? Click the Help button!",
                mainMenuKeyboard
            );
            return;
        }

        const response = await botService.reedemCode(
            discountCode,
            String(ctx.from.id)
        );

        if (response.success && response.responseObject) {
            await ctx.reply(
                "✅ Discount successfully redeemed!\n\n" +
                formatDiscountMessage(response.responseObject) +
                "\n📱 Show this message to the restaurant staff.",
                mainMenuKeyboard
            );
        } else {
            await ctx.reply(
                "❌ " + (response.message || "Unable to redeem discount code."),
                mainMenuKeyboard
            );
        }
    } catch (error) {
        logger.error("Error in text handler:", error);
        await ctx.reply(
            "Sorry, I couldn't process the discount code. Please try again.",
            mainMenuKeyboard
        );
    }
});

// Error handling middleware
bot.catch((error: any, ctx: any) => {
    logger.error("Bot error:", error);
    ctx.reply(
        "An unexpected error occurred. Please try again later.",
        mainMenuKeyboard
    );
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;