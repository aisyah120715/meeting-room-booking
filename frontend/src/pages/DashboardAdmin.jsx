import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  FiLogOut, 
  FiCalendar, 
  FiClock, 
  FiUser, 
  FiHome,
  FiCheckCircle, 
  FiXCircle,
  FiChevronRight,
  FiAlertCircle,
  FiSettings
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";
import { Link, useNavigate} from "react-router-dom";

export default function DashboardAdmin() {
  const [bookings, setBookings] = useState([]);
  const [summary, setSummary] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const { user } = useAuth();
  const navigate = useNavigate();

  const API_URL = process.env.REACT_APP_API_URL;
  const API_BASE = `${API_URL}/api/admin`;


  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setMsg("");
      await Promise.all([
        fetchBookings(),
        fetchSummary()
      ]);
    } catch (err) {
      console.error("Fetch error:", err);
      setMsg("❌ Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/bookings`);
      setBookings(res.data);
    } catch (err) {
      console.error("Bookings API error:", err);
      throw err;
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE}/summary`);
      setSummary(res.data.slice(0, 5));
    } catch (err) {
      console.error("Summary API error:", err);
      throw err;
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.post(`${API_BASE}/update-status`, { id, status });
      setMsg(`✅ Booking ${status}`);
      await fetchAllData();
    } catch (err) {
      console.error("Update error:", err);
      setMsg("❌ Action failed");
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return isNaN(date) ? dateStr : date.toLocaleDateString("en-GB", {
        year: "numeric", 
        month: "short", 
        day: "numeric"
      });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr) => {
    return timeStr?.replace(/([ap]m)/i, match => ` ${match.toUpperCase()}`) || "";
  };

  const filteredBookings = bookings.filter(b => 
    activeTab === "all" ? true : b.status === activeTab
  );

  return (
    <div className="flex min-h-screen bg-gray-50 font-poppins">
      {/* Sidebar */}
      <div className="w-72 bg-gradient-to-b from-indigo-800 to-indigo-900 shadow-xl hidden md:flex flex-col p-6 text-white">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1 flex items-center">
            <span className="bg-white text-indigo-800 rounded-lg p-1 mr-2">
              <FiSettings />
            </span>
            AdminHub
          </h2>
          <p className="text-indigo-300 text-sm">Control Center</p>
        </div>
        
        <nav className="flex-1 space-y-1">
          <Link 
            to="/admin" 
            className="flex items-center p-3 text-white bg-indigo-700 rounded-lg transition-all hover:bg-indigo-600 group"
          >
            <FiHome className="mr-3 text-lg group-hover:scale-110 transition-transform" />
            <span>Dashboard</span>
            <FiChevronRight className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-indigo-700">
          <div className="flex items-center mb-4 p-3 bg-indigo-700 rounded-lg group hover:bg-indigo-600 transition-colors">
            <div className="p-2 bg-indigo-600 rounded-full mr-3 group-hover:bg-indigo-500 transition-colors">
              <FiUser className="text-white" />
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name || "Admin"}</p>
              <p className="text-xs text-indigo-300">{user?.email || "admin@example.com"}</p>
            </div>
          </div>
          
       <button 
            className="flex items-center w-full p-3 text-indigo-200 hover:bg-indigo-700 rounded-lg transition-all group"
            onClick={() => {
                // Add your logout logic here (if any)
                navigate("/login"); // Redirect to login page using React Router
            }}
            >
            <FiLogOut className="mr-3 text-lg group-hover:scale-110 transition-transform" />
            <span>Logout</span>
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {/* Header */}
        <header className="bg-white shadow-sm p-6 mb-6 rounded-xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
              <p className="text-gray-600">Manage booking requests</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-sm text-gray-500">Live</span>
            </div>
          </div>
        </header>

        {/* Notification */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-6 p-4 rounded-xl shadow-md ${msg.includes("❌") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}
            >
              <div className="flex items-center">
                {msg.includes("❌") ? (
                  <FiAlertCircle className="mr-2 text-lg" />
                ) : (
                  <FiCheckCircle className="mr-2 text-lg" />
                )}
                {msg}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-800">Booking Requests</h2>
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                {["all", "pending", "approved", "rejected"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1 text-sm rounded-md capitalize ${activeTab === tab ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-200"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No {activeTab === "all" ? "" : activeTab} bookings found
                </div>
              ) : (
                <AnimatePresence>
                  {filteredBookings.map((b) => (
                    <motion.div 
                      key={b.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileHover={{ backgroundColor: "#f9fafb" }}
                      className={`p-6 transition-colors ${b.status === "approved" ? "bg-green-50" : b.status === "rejected" ? "bg-red-50" : ""}`}
                    >
                      <div className="flex flex-col md:flex-row md:justify-between md:items-start">
                        <div className="mb-4 md:mb-0">
                          <div className="flex items-center">
                            <h3 className="font-bold text-lg text-indigo-800">{b.room}</h3>
                            <span className={`ml-3 px-2 py-1 rounded-full text-xs font-medium ${
                              b.status === "approved" 
                                ? "bg-green-100 text-green-800" 
                                : b.status === "rejected" 
                                  ? "bg-red-100 text-red-800" 
                                  : "bg-yellow-100 text-yellow-800"
                            }`}>
                              {b.status}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-600 mt-2">
                            <FiCalendar className="mr-2" />
                            <span>{formatDate(b.date)}</span>
                          </div>
                          <div className="flex items-center text-gray-600 mt-1">
                            <FiClock className="mr-2" />
                            <span>{formatTime(b.time)} - {formatTime(b.end_time)}</span>
                          </div>
                          <div className="mt-3 text-sm">
                            <p className="font-medium">{b.userName}</p>
                            <p className="text-gray-500">{b.userEmail}</p>
                          </div>
                        </div>
                        
                        {b.status === "pending" && (
                          <div className="flex gap-3 justify-start md:justify-end">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center shadow-md"
                              onClick={() => updateStatus(b.id, "approved")}
                            >
                              <FiCheckCircle className="mr-2" /> Approve
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center shadow-md"
                              onClick={() => updateStatus(b.id, "rejected")}
                            >
                              <FiXCircle className="mr-2" /> Reject
                            </motion.button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Recent Summary */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800">Recent Activity</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg">
                      <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
                      <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
                    </div>
                  ))
                ) : summary.length > 0 ? (
                  summary.map((s, i) => (
                    <motion.div 
                      key={i}
                      whileHover={{ x: 5 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-800">{formatDate(s.date)}</p>
                        <p className="text-sm text-gray-500">{s.total} bookings</p>
                      </div>
                      <div className={`h-2 rounded-full ${i < 2 ? "bg-green-500" : "bg-gray-300"}`} 
                        style={{ width: `${(s.total / (Math.max(...summary.map(d => d.total)) || 1)) * 100}%` }}>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No recent activity</p>
                )}
              </div>
              <div className="mt-6 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                <p className="text-indigo-800 font-medium">Peak booking day:</p>
                {loading ? (
                  <>
                    <div className="h-6 w-40 bg-gray-200 rounded animate-pulse my-1"></div>
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                  </>
                ) : summary.length > 0 ? (
                  <>
                    <p className="text-xl font-bold text-indigo-600">
                      {formatDate(summary[0].date)}
                    </p>
                    <p className="text-sm text-indigo-500">{summary[0].total} bookings</p>
                  </>
                ) : (
                  <p className="text-indigo-600">N/A</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}