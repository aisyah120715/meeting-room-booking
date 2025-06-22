import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function WelcomePage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-white p-4"
      style={{
        backgroundImage: `url('http://googleusercontent.com/image_generation_content/0')`, // Add the image URL here
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        // You might want to adjust the gradient if the image already provides enough color
        // background: 'linear-gradient(to br, rgba(102, 126, 234, 0.7), rgba(0, 138, 184, 0.7))', // Example with opacity
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white drop-shadow-md">
          Simple Booking System
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-xl md:text-2xl mb-10 max-w-2xl leading-relaxed"
        >
          Effortlessly manage meeting rooms, lab equipment, and study pods with our intuitive booking platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            to="/login"
            className="bg-white text-blue-600 px-8 py-3 rounded-lg hover:bg-gray-100 font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="bg-transparent border-2 border-white px-8 py-3 rounded-lg hover:bg-white hover:text-blue-600 font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            Sign Up
          </Link>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-8 text-sm text-white"
      >
        Simple, Fast, Reliable
      </motion.div>
    </div>
  );
}