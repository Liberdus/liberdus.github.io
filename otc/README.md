# OTC Frontend

A decentralized over-the-counter trading interface for ERC20 tokens.

## 🌟 Features

- Create and manage OTC orders for ERC20 tokens
- View available orders as a taker (ViewOrders.js)
- Real-time order updates via WebSocket (WebSocket.js)
- Token price discovery and deal calculations (PricingService.js)
- Order cleanup functionality (Cleanup.js)
- Advanced filtering and sorting options 
- Responsive design with dark/light theme support
- Debug panel for development

## 📋 Prerequisites

- Modern web browser with MetaMask or similar Web3 wallet
- Node.js (for development)
- Access to Polygon network (mainnet)

## 🚀 Quick Start (local environment)

1. Clone the repository:
```bash
git https://github.com/Liberdus/liberdus.github.io
cd liberdus.github.io
```

2. Configure your environment:
   - Update network configurations in `js/config.js`

3. Start the development server:
```bash
# Using npm
npm ci
npm http-server
```

4. Enter OTC webpage by using one of these local URLs provided by running `http-server`
```
Available on:
  http://127.0.0.1:8080
  http://192.168.86.49:8080
  http://10.96.0.72:8080
```

## 🏗️ Project Structure

```
otc/
├── css/                    # Styling
│   ├── components/        # Component-specific styles
│   └── styles.css        # Global styles
├── js/
│   ├── abi/              # Contract ABIs
│   ├── components/       # UI Components
│   ├── services/        # Core services
│   └── app.js           # Main application
├── docs/                 # Documentation
```

## 🔧 Core Components

### Components
- `CreateOrder`: Order creation interface
- `ViewOrders`: Base order viewing functionality
- `MyOrders`: Seller's order management
- `TakerOrders`: Buyer's order interface
- `Cleanup`: Order cleanup functionality
- `ContractParams`: Contract configuration display

### Services
- `WebSocket`: Real-time order updates
- `PricingService`: Token price discovery
- `WalletManager`: Wallet connection handling

## 📖 Documentation

Detailed documentation is available in the `/docs` directory:
- [Data Structures](docs/data-structures.md)
- [Refresh Button Implementation](docs/refresh-button.md)

## 🔍 Debugging

1. Enable debug mode by adding `debug=true` to URL parameters
2. Use the Debug Panel (accessible via UI) to:
   - Monitor WebSocket events
   - Track order updates
   - View token cache
   - Test error scenarios

## 🛠️ Development

### Adding New Features

1. Create component in `js/components/`
2. Add corresponding styles in `css/components/`
3. Register component in `app.js`
4. Update documentation

### Code Style
- Use ES6+ features
- Follow component-based architecture
- Maintain consistent error handling
- Document complex logic
- Use CSS variables for theming

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration
```

## 🔐 Security

- All transactions require explicit user approval
- Token approvals are managed per order
- Price calculations include slippage protection
- Real-time validation of order parameters

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Ethers.js](https://docs.ethers.io/v5/)
- [Web3Modal](https://github.com/Web3Modal/web3modal)
- [Community contributors]



