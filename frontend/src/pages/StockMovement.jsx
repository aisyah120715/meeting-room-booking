import React, { useState, useEffect } from 'react';
import './StockMovement.css';

const StockMovement = () => {
  const [stockCategories, setStockCategories] = useState([]);
  const [stockItemsByCategory, setStockItemsByCategory] = useState({});
  const [stockHistory, setStockHistory] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    stockItem: '',
    quantity: '',
    deliveryOrder: ''
  });
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: '' });
  const [loading, setLoading] = useState(false);

  // Load stock data on component mount
  useEffect(() => {
    loadStockData();
    loadStockHistory();
  }, []);

  const loadStockData = async () => {
    try {
      const response = await fetch('/api/dashboard');
      if (response.ok) {
        const data = await response.json();
        const categories = [...new Set(data.map(item => item.CATEGORY).filter(Boolean))];
        
        const itemsByCategory = {};
        data.forEach(item => {
          if (item.CATEGORY && item.ITEMS) {
            if (!itemsByCategory[item.CATEGORY]) {
              itemsByCategory[item.CATEGORY] = [];
            }
            if (!itemsByCategory[item.CATEGORY].includes(item.ITEMS)) {
              itemsByCategory[item.CATEGORY].push(item.ITEMS);
            }
          }
        });
        
        setStockCategories(categories);
        setStockItemsByCategory(itemsByCategory);
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    }
  };

  const loadStockHistory = async () => {
    try {
      const response = await fetch('/api/stockin');
      if (response.ok) {
        const data = await response.json();
        setStockHistory(data.reverse()); // Show latest first
      }
    } catch (error) {
      console.error('Error loading stock history:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.date || !formData.stockItem || !formData.quantity || formData.quantity === '0') {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch('/api/add-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockData: [{
            date: formData.date,
            stockItem: formData.stockItem,
            quantity: parseInt(formData.quantity),
            deliveryOrder: formData.deliveryOrder || ''
          }]
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          alert('Stock movement recorded successfully!');
          setFormData({
            date: new Date().toISOString().split('T')[0],
            stockItem: '',
            quantity: '',
            deliveryOrder: ''
          });
          loadStockHistory();
        }
      }
    } catch (error) {
      console.error('Error submitting stock movement:', error);
      alert('Error recording stock movement. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItem.name || !newItem.category) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch('/api/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          CATEGORY: newItem.category,
          ITEMS: newItem.name,
          STOCK_IN: 0,
          STOCK_OUT: 0,
          SOH: 0
        })
      });

      if (response.ok) {
        alert('New item added successfully!');
        setNewItem({ name: '', category: '' });
        setShowAddItemModal(false);
        loadStockData();
      }
    } catch (error) {
      console.error('Error adding new item:', error);
      alert('Error adding new item. Please try again.');
    }
  };

  const deleteStockRecord = async (index) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const response = await fetch(`/api/stockin/${index}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          alert('Record deleted successfully!');
          loadStockHistory();
        }
      } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error deleting record. Please try again.');
      }
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="stock-movement-container">
      <div className="page-header">
        <h1>📦 Stock Movement</h1>
        <p className="page-subtitle">Record stock movements and keep inventory updated in real-time</p>
      </div>

      {/* Stock Movement Form */}
      <div className="form-card">
        <div className="card-header">
          <h2>
            <i className="icon">📝</i>
            Record Stock Movement
          </h2>
          <button 
            className="refresh-btn"
            onClick={loadStockData}
            disabled={loading}
          >
            <i className="icon">🔄</i>
            Refresh Items
          </button>
        </div>

        <form onSubmit={handleSubmit} className="stock-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="stockItem">Stock Item</label>
              <div className="select-with-button">
                <select
                  id="stockItem"
                  name="stockItem"
                  value={formData.stockItem}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">-- Select Item --</option>
                  {stockCategories.map(category => (
                    <optgroup key={category} label={category}>
                      {stockItemsByCategory[category]?.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  className="add-item-btn"
                  onClick={() => setShowAddItemModal(true)}
                >
                  <i className="icon">➕</i>
                  Add New Item
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="quantity">
                Quantity
                <small>Positive for Stock In, Negative for Stock Out</small>
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                placeholder="e.g., 100 or -50"
                className={`quantity-input ${
                  formData.quantity > 0 ? 'positive' : 
                  formData.quantity < 0 ? 'negative' : ''
                }`}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="deliveryOrder">Delivery Order / Notes</label>
              <input
                type="text"
                id="deliveryOrder"
                name="deliveryOrder"
                value={formData.deliveryOrder}
                onChange={handleInputChange}
                placeholder="DO Number or Notes"
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="icon spinning">⏳</i>
                  Processing...
                </>
              ) : (
                <>
                  <i className="icon">✅</i>
                  Record Movement
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Stock History */}
      <div className="history-card">
        <div className="card-header">
          <h2>
            <i className="icon">📊</i>
            Recent Stock Movements
          </h2>
          <button 
            className="refresh-btn"
            onClick={loadStockHistory}
          >
            <i className="icon">🔄</i>
            Refresh
          </button>
        </div>

        <div className="table-container">
          <table className="stock-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Type</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stockHistory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="no-data">
                    No stock movements recorded yet
                  </td>
                </tr>
              ) : (
                stockHistory.map((record, index) => {
                  const quantity = parseInt(record.quantity) || 0;
                  const isStockOut = quantity < 0;
                  
                  return (
                    <tr key={index}>
                      <td>{formatDate(record.date)}</td>
                      <td>{record.item}</td>
                      <td>
                        <span className={`quantity-badge ${isStockOut ? 'negative' : 'positive'}`}>
                          {isStockOut ? '↓' : '↑'} {Math.abs(quantity)}
                        </span>
                      </td>
                      <td>
                        <span className={`type-badge ${isStockOut ? 'stock-out' : 'stock-in'}`}>
                          {isStockOut ? 'Stock Out' : 'Stock In'}
                        </span>
                      </td>
                      <td>{record.do || 'N/A'}</td>
                      <td>
                        <button
                          className="delete-btn"
                          onClick={() => deleteStockRecord(record.index)}
                          title="Delete record"
                        >
                          <i className="icon">🗑️</i>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="modal-overlay" onClick={() => setShowAddItemModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="icon">➕</i>
                Add New Stock Item
              </h3>
              <button 
                className="close-btn"
                onClick={() => setShowAddItemModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="newItemName">Item Name</label>
                <input
                  type="text"
                  id="newItemName"
                  value={newItem.name}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter item name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newItemCategory">Category</label>
                <select
                  id="newItemCategory"
                  value={newItem.category}
                  onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                >
                  <option value="">-- Select Category --</option>
                  {stockCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                className="cancel-btn"
                onClick={() => setShowAddItemModal(false)}
              >
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleAddNewItem}
              >
                <i className="icon">💾</i>
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockMovement;