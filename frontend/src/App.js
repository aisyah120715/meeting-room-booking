// src/App.jsx
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import BookingCalendar from "./pages/BookingCalendar";
import MyBookings from "./pages/MyBookings";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardUser from "./pages/DashboardUser";
import DashboardAdmin from "./pages/DashboardAdmin";
import WelcomePage from "./pages/WelcomePage";
import StockMovement from "./pages/StockMovement";

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/calendar" element={<BookingCalendar />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/dashboard-user" element={<DashboardUser />} />
        <Route path="/dashboard-admin" element={<DashboardAdmin />} />
        <Route path="/stock-movement" element={<StockMovement />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
