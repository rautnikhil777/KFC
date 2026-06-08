# TODO - Fix only GET /api/menu "Route not found"

- [x] Inspect routing: backend/src/routes/index.js mounts menuRoutes at /menu
- [x] Inspect backend/src/routes/menuRoutes.js export and router.get implementation
- [x] Check backend/src/server.js mounting behavior (no change)
- [x] Run GET /api/menu against running backend and verify JSON response
- [x] Apply minimal code change only in menu API files (menuRoutes)
- [ ] Verify other APIs unchanged (order/kitchen/session/payment/cart)


