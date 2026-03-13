# 🚗 Rent Cars Georgia — Premium Car Rental Marketplace

A world-class, fully-responsive car rental marketplace with modern UI/UX design for exploring Georgia.

---

## 📁 Project Structure

```
Myrent.com/
├── index.html           # Main homepage
├── login.html           # Client login page
├── register.html        # Client registration page
├── style.css            # Main stylesheet with flex layouts
├── auth.css             # Authentication pages stylesheet
├── script.js            # Main homepage functionality
├── auth.js              # Authentication functionality
└── README.md            # This file
```

---

## 🎨 Design Features

### **Color Palette**
- **Primary Background**: Sage Grey (`#f1f5f9`)
- **Header/Footer**: Deep Forest Green (`#0f3d3e`)
- **Primary CTA**: Terracotta Orange (`#e27d60`)
- **Accent**: Gold (`#d4af37`)

### **Typography**
- Font Family: San Francisco / Inter / System fonts
- Responsive sizing (scales with viewport)
- Optimal line heights for readability

### **Layout System**
- **Fully Flexbox-based** for all platforms
- Desktop-first responsive design
- Smooth transitions and animations
- Glassmorphism effects

---

## 📄 Pages

### **1. Homepage (index.html)**
- Sticky header with navigation
- Hero section with glassmorphic booking widget
- Trip-based filtering (Mountain/City/Coast)
- Bento grid features section
- "How It Works" section
- Partner testimonials
- Partner CTA section
- Floating WhatsApp & map widgets
- Footer with links

**Features:**
- Trip selection (automatically filters vehicles)
- Currency selector (AED/EUR/GBP)
- Booking widget with date/time pickers
- Free delivery zone calculation
- Partner onboarding modal

### **2. Login Page (login.html)**
- Two-column layout (Desktop) / Single column (Mobile)
- Branding panel on left with benefits
- Login form on right
- Email and password fields
- "Remember me" checkbox
- Social login buttons (Google/Facebook)
- Password visibility toggle
- Input validation
- Responsive design for all screen sizes

**Features:**
- Email validation
- Password requirements
- Session storage
- Remember me functionality (30 days)
- Real-time error messages
- Loading states

### **3. Registration Page (register.html)**
- Multi-step form (3 steps)
- Progress indicator
- Step-by-step validation
- Animated step transitions

**Steps:**
1. **Basic Info**: Full name, email, phone
2. **Details**: Password, DOB, country
3. **Verification**: License type, agreements

**Features:**
- Password strength indicator
- Age verification (18+)
- Terms & conditions agreement
- Privacy policy consent
- Marketing opt-in
- Success message on completion
- Form data validation
- Auto-redirect after success

---

## 🎯 Responsive Design

### **All Platforms Supported**
- ✅ Desktop (1024px and above)
- ✅ Tablet (768px - 1023px)
- ✅ Mobile (480px - 767px)
- ✅ Small Mobile (below 480px)

### **Flex Layout Features**
- Flexible containers for all screen sizes
- `flex-direction` changes for mobile
- Gap management for spacing
- Grid to stack transitions
- Touch-friendly buttons and spacing
- Optimized font sizes for readability

### **Mobile Optimizations**
- Collapsed header navigation
- Stacked form layouts
- Full-width buttons
- Touch-friendly inputs
- Smooth scrolling
- Floating support button

---

## 🔐 Authentication System

### **Login Workflow**
1. User enters email and password
2. Optional "Remember me" checkbox
3. Email validation
4. Password validation
5. Social login options (Google/Facebook)
6. Session storage on success
7. Redirect to homepage

### **Registration Workflow**
1. **Step 1**: Collect basic info (name, email, phone)
2. **Step 2**: Password setup & personal details
3. **Step 3**: License type & legal agreements
4. Form validation at each step
5. Success message
6. Auto-redirect to homepage

### **Features**
- Real-time validation
- Password strength indicator
- Confirm password matching
- Age verification (18+)
- Email verification
- Terms & conditions agreement
- Privacy policy consent
- Marketing opt-in option

---

## 🎯 Functional Features

### **Trip-Based Filtering**
```javascript
Mountain: 4×4, Off-road, SUV
City: Sedan, Comfort, Economy
Coast: Convertible, SUV, Adventure
```

### **Booking Widget**
- Pickup/drop-off locations
- Date & time selection
- Trip type selection
- Dynamic vehicle matching
- Currency selection (AED/EUR/GBP)

### **Free Delivery Zone**
- Automatic detection
- Includes: Tbilisi, Gldani, Vake, Saburtalo
- Distance-based fees outside zone

### **WhatsApp Integration**
- Quick chat button
- Pre-filled message with trip details
- Mobile-friendly

### **Partner Onboarding**
- 4-step KYC process
- Document uploads
- Vehicle details
- Insurance proof
- Bank details for payouts
- Verification status tracking

---

## 🚀 JavaScript Features

### **Main Script (script.js)**
- Trip selection handler
- Currency converter
- Authentication modal
- Partner onboarding stepper
- WhatsApp integration
- Map widget functionality
- Booking form validation
- Modal management
- Smooth scrolling
- Scroll animations
- Header scroll effects
- Accessibility features

### **Auth Script (auth.js)**
- Login form handling
- Registration multi-step handler
- Form validation
- Password strength checker
- Email validation
- Session management
- localStorage for "Remember me"
- Social login integration
- Loading states
- Error messaging

---

## 🎨 CSS Architecture

### **Main Stylesheet (style.css)**
- CSS variables for colors and spacing
- Flexbox-based layouts
- Glassmorphism effects
- Smooth transitions and animations
- Responsive breakpoints
- Print styles

### **Auth Stylesheet (auth.css)**
- Authentication page layouts
- Two-column design
- Form styling
- Progress indicators
- Multi-step form animations
- Mobile-first responsive
- Dark mode support

### **Responsive Breakpoints**
```css
Desktop:     1024px and above
Tablet:      768px - 1023px
Mobile:      480px - 767px
Small Mobile: below 480px
```

---

## 🎮 How to Use

### **1. Run Homepage**
```bash
# Open in browser
- File > Open File > index.html
# Or
- Right-click index.html > Open with > Browser
```

### **2. Test Login**
- Click "Login" button in header
- Or navigate to `login.html`
- Enter test email: `test@example.com`
- Enter password: `password123`
- Test "Remember me" functionality

### **3. Test Registration**
- Click "Register" button in header
- Or navigate to `register.html`
- Fill in each step
- Watch password strength indicator
- Accept agreements
- Complete registration

### **4. Test Responsive Design**
- Resize browser window
- Use DevTools device emulation
- Test on actual devices

---

## 🔧 Customization

### **Change Brand Name**
Edit in `index.html`:
```html
<span>Tripy.ge</span> → <span>Your Brand</span>
```

### **Change Colors**
Edit variables in `style.css`:
```css
:root {
    --sage-grey: #f1f5f9;
    --forest-green: #0f3d3e;
    --terracotta: #e27d60;
    --gold: #d4af37;
}
```

### **Change Currencies**
Edit in `index.html` and `script.js`:
```html
<option value="USD">USD</option>
```

### **Update Free Delivery Zone**
Edit in `script.js`:
```javascript
const freeDeliveryZones = ['tbilisi', 'gldani', 'vake', 'saburtalo'];
```

---

## 📱 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 🔑 Features Highlight

### **User Experience**
- ✨ Smooth animations and transitions
- 🎯 Clear call-to-action buttons
- 📱 Mobile-first responsive design
- ♿ Accessibility features
- 🌙 Dark mode ready

### **Performance**
- ⚡ Optimized CSS with minimal bundling
- 🖼️ SVG icons (scalable)
- 🎨 CSS-based animations (GPU accelerated)
- 📦 Lightweight JavaScript

### **Security**
- 🔒 Form validation
- 📧 Email verification
- 🔑 Password requirements
- 👤 Age verification
- 📋 Terms & conditions

---

## 📝 Form Validation

### **Login Form**
- Email format validation
- Password required (min 6 chars)
- Real-time error messages

### **Registration Form**
- Name (min 3 characters)
- Email (valid format)
- Phone (valid format)
- Password (min 8 chars)
- Password match confirmation
- Age (18+ required)
- Country selection
- License type selection
- Terms agreement required
- Privacy agreement required

---

## 🎯 Future Enhancements

- Payment gateway integration
- Vehicle booking system
- User dashboard
- Admin panel
- Real-time chat support
- Booking history
- Wishlist functionality
- Review and ratings
- Email notifications
- SMS notifications
- Push notifications

---

## 📄 License

This project is provided as-is for demonstration and educational purposes.

---

## 💬 Support

For questions or support, contact: `info@rentcarsgeorgia.com`

---

**Made with ❤️ for Premium Car Rental Experience**

Last Updated: February 2026
