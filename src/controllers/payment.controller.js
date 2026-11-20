// 1. Create Stripe Checkout Session
export const createCheckoutSessionController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can make payments",
      });
    }

    const { bookingId } = req.body;

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to pay for this booking",
      });
    }

    if (
      booking.status !== "completed" ||
      booking.paymentStatus !== "unpaid"
    ) {
      return res.status(400).json({
        success: false,
        message: "This booking is not eligible for payment",
      });
    }

    const existingPayment = await getPaymentByBookingId(
      bookingId
    );

    if (existingPayment) {
      return res.status(409).json({
        success: false,
        message: "Payment already exists",
      });
    }

    const frontendURL = process.env.FRONTEND_URL;

    if (!frontendURL) {
      throw new Error("FRONTEND_URL is not configured");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "payment",

      customer_email: req.user.email,

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: booking.serviceTitle,
            },
            unit_amount: Math.round(booking.finalAmount * 100),
          },
          quantity: 1,
        },
      ],

      metadata: {
        bookingId: booking._id.toString(),
      },

      success_url: `${frontendURL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url: `${frontendURL}/payment/cancel`,
    });

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      sessionId: session.id,
      checkoutUrl: session.url,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 2. Verify Stripe Payment
export const verifyPaymentController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can verify payments",
      });
    }

    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Stripe session ID is required",
      });
    }

    // Retrieve session directly from Stripe
    const session = await stripe.checkout.sessions.retrieve(
      sessionId
    );

    if (session.payment_status !== "paid") {
      return res.status(400).json({
        success: false,
        message: "Payment has not been completed",
      });
    }

    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: "Booking information not found",
      });
    }

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to verify this payment",
      });
    }

    if (
      session.customer_email !== req.user.email ||
      session.currency !== "usd" ||
      session.amount_total !== Math.round(booking.finalAmount * 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Payment information does not match",
      });
    }

    if (
      booking.status !== "completed" ||
      booking.paymentStatus !== "unpaid"
    ) {
      return res.status(400).json({
        success: false,
        message: "Booking is not eligible for payment",
      });
    }

    const existingPayment = await getPaymentByStripeSession(
      sessionId
    );

    if (existingPayment) {
      return res.status(200).json({
        success: true,
        message: "Payment has already been verified",
        payment: existingPayment,
      });
    }

    if (!session.payment_intent) {
      return res.status(400).json({
        success: false,
        message: "Stripe transaction ID not found",
      });
    }

    const paymentData = {
      bookingId,
      amount: booking.finalAmount,
      transactionId: session.payment_intent,
      stripeSessionId: session.id,
    };

    const result = await createPayment(paymentData);

    res.status(200).json({
      success: true,
      message: "Payment verified and saved successfully",
      paymentId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 3. Get Customer Payment History
export const getCustomerPaymentHistoryController = async (req, res) => {
  try {
    if (req.user?.role !== "customer") {
      return res.status(403).json({
        success: false,
        message: "Only customers can access payment history",
      });
    }

    const payments = await getCustomerPayments(req.user.email);

    res.status(200).json({
      success: true,
      message: "Payment history retrieved successfully",
      totalPayments: payments.length,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 4. Get Payment by Booking ID
export const getPaymentByBookingIdController = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const payment = await getPaymentByBookingId(bookingId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    const booking = await getBookingById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const isCustomer =
      req.user?.role === "customer" &&
      booking.customerEmail === req.user.email;

    const isTechnician =
      req.user?.role === "technician" &&
      booking.technicianEmail === req.user.email;

    const isAdmin = req.user?.role === "admin";

    if (!isCustomer && !isTechnician && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this payment",
      });
    }

    res.status(200).json({
      success: true,
      message: "Payment retrieved successfully",
      payment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// 5. Get All Payments (Admin)
export const getAllPaymentsController = async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can access all payments",
      });
    }

    const payments = await getAllPayments();

    res.status(200).json({
      success: true,
      message: "All payments retrieved successfully",
      totalPayments: payments.length,
      payments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};