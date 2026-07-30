## FoodLink AI Deliverable

Frontend:
- `frontend/src/screens/PostSurplusScreen.tsx`
- `frontend/src/components/StorageConditionChips.tsx`
- `frontend/src/services/surplusApi.ts`
- `frontend/src/constants/postSurplus.ts`
- `frontend/src/types/postSurplus.ts`

Backend:
- `backend/src/routes/predictFreshness.js`
- `backend/src/services/freshnessService.js`
- `backend/src/app.js`

Integration notes:
- React Native screen expects NativeWind/Tailwind support.
- Install `@react-native-picker/picker` and `@react-native-community/datetimepicker`.
- Replace the placeholder camera function with `expo-image-picker` or `react-native-image-picker`.
- Backend route expects `multer` for multipart form uploads.

Website demo:
- `foodlink.html`
- `foodlink.css`
- `foodlink.js`
- Open `foodlink.html` in the browser for a standalone web version of the screen and prediction flow.
