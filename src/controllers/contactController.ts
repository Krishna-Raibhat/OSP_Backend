import type { Request, Response } from "express";
import { HttpError, validateEmail, validatePhone, validateStringLength } from "../utils/errors";
import { sendContactUsEmail } from "../utils/emailService";

/* ==================== CONTACT US CONTROLLER ==================== */

// Send contact us message via email
export async function sendContactMessage(req: Request, res: Response) {
  try {
    const { fullName, email, phone, message } = req.body;

    // Validate required fields
    if (!fullName || !email || !phone || !message) {
      return res.status(400).json({ 
        message: "All fields are required: fullName, email, phone, message" 
      });
    }

    // Validate field formats and lengths
    validateStringLength(fullName, "Full name", 2, 100);
    validateEmail(email, "Email");
    validatePhone(phone, "Phone");
    validateStringLength(message, "Message", 10, 2000);

    // Basic spam detection
    const spamKeywords = ['viagra', 'casino', 'lottery', 'winner', 'congratulations', 'click here', 'free money'];
    const messageText = message.toLowerCase();
    const hasSpam = spamKeywords.some(keyword => messageText.includes(keyword));
    
    if (hasSpam) {
      console.warn(`Potential spam detected from ${email}: ${message.substring(0, 100)}...`);
      // Still return success to not reveal spam detection
      return res.status(200).json({
        message: "Thank you for your message! We'll get back to you soon.",
        success: true,
      });
    }

    // Check for suspicious patterns (all caps, excessive punctuation)
    const allCaps = message === message.toUpperCase() && message.length > 20;
    const excessivePunctuation = (message.match(/[!?]{3,}/g) || []).length > 0;
    
    if (allCaps || excessivePunctuation) {
      console.warn(`Suspicious message pattern from ${email}`);
    }

    // Send email
    const emailSent = await sendContactUsEmail({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      message: message.trim(),
    });

    if (!emailSent) {
      console.error(`Failed to send contact email from ${email}`);
      return res.status(500).json({ 
        message: "Failed to send message. Please try again later." 
      });
    }

    // Log successful contact for monitoring
    console.log(`Contact message sent successfully from ${email} (${fullName})`);

    return res.status(200).json({
      message: "Thank you for your message! We'll get back to you soon.",
      success: true,
    });
  } catch (err: any) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ message: err.message });
    }
    console.error("Contact us error:", err);
    return res.status(500).json({ 
      message: "Server error. Please try again later." 
    });
  }
}