import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function VendorAllocation() {
  const [events, setEvents] = useState<any[]>([])
  const [vendorList, setVendorList] = useState<string[]>([])
  
  // Form State
  const [selectedEvent, setSelectedEvent] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [tagType, setTagType] = useState('')
  const [initialStock, setInitialStock] = useState('')
  const [price, setPrice] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })

  // Fetch available events and registered vendors on load
  useEffect(() => {
    async function fetchInitialData() {
      // Fetch Events
      const { data: eventData } = await supabase.from('events').select('name')
      if (eventData) setEvents(eventData)

      // Fetch Vendors (change 'vendor_auth' to 'vendors' if your main list is there)
      const { data: vendorData } = await supabase.from('vendor_auth').select('vendor_name')
      if (vendorData) {
        setVendorList(vendorData.map(v => v.vendor_name))
      }
    }
    fetchInitialData()
  }, [])

  const handleAllocate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedEvent || !vendorName || !tagType || !initialStock || !price) {
      setStatus({ message: '⚠️ Please fill in all fields.', type: 'error' })
      return
    }

    setIsSubmitting(true)
    setStatus({ message: '', type: '' })

    const stockQty = parseInt(initialStock)
    const ticketPrice = parseFloat(price)

    // 1. Check for existing allocation for this vendor, event, and tag
    const { data: existingRow, error: fetchError } = await supabase
      .from('inventory')
      .select('*')
      .eq('event_name', selectedEvent)
      .eq('vendor_name', vendorName)
      .eq('tag_type', tagType)
      .single()

    if (existingRow) {
      // 2. REFILL LOGIC: Add to existing allocation
      const newInitial = (existingRow.initial_stock || 0) + stockQty
      const newStock = (existingRow.stock_count || 0) + stockQty

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ 
          initial_stock: newInitial, 
          stock_count: newStock, 
          price: ticketPrice 
        })
        .eq('event_name', selectedEvent)
        .eq('vendor_name', vendorName)
        .eq('tag_type', tagType)

      setIsSubmitting(false)

      if (!updateError) {
        setStatus({ 
          message: `✅ REFILL SUCCESS: Added ${stockQty} to ${vendorName}'s ${tagType} batch. New Total: ${newInitial}`, 
          type: 'success' 
        })
        setInitialStock('')
      } else {
        setStatus({ message: `❌ Update Error: ${updateError.message}`, type: 'error' })
      }

    } else {
      // 3. NEW ASSIGNMENT LOGIC: Insert a brand new row
      const { error: insertError } = await supabase
        .from('inventory')
        .insert([
          {
            event_name: selectedEvent,
            vendor_name: vendorName,
            tag_type: tagType,
            initial_stock: stockQty,
            stock_count: stockQty,
            price: ticketPrice
          }
        ])

      setIsSubmitting(false)

      if (!insertError) {
        setStatus({ 
          message: `✅ NEW ASSIGNMENT: Issued ${stockQty} ${tagType} tags to ${vendorName}.`, 
          type: 'success' 
        })
        setTagType('')
        setInitialStock('')
        setPrice('')
      } else {
        setStatus({ message: `❌ Insert Error: ${insertError.message}`, type: 'error' })
      }
    }
  }

  return (
    <div className="bg-gray-900 p-6 rounded-lg shadow-md border border-gray-700 font-sans text-gray-100 max-w-lg mx-auto mt-10">
      <header className="mb-6 border-b-2 border-mmarumoRed pb-4">
        <h2 className="text-xl font-bold text-mmarumoRed">M.Marumo Technologies</h2>
        <h3 className="text-md text-gray-300">Issue Vendor Allocation</h3>
      </header>

      <form onSubmit={handleAllocate} className="space-y-4">
        
        {/* Event Selection */}
        <div>
          <label className="block text-sm font-bold text-mmarumoBlue mb-1">Target Event</label>
          <select 
            className="w-full p-3 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
          >
            <option value="">-- Select Event --</option>
            {events.map((evt, idx) => (
              <option key={idx} value={evt.name}>{evt.name}</option>
            ))}
          </select>
        </div>

        {/* Vendor Dropdown */}
        <div>
          <label className="block text-sm font-bold text-mmarumoBlue mb-1">Select Vendor</label>
          <select 
            className="w-full p-3 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
          >
            <option value="">-- Choose a Vendor --</option>
            {vendorList.map((vendor, idx) => (
              <option key={idx} value={vendor}>{vendor}</option>
            ))}
          </select>
        </div>

        {/* QR Tag Type */}
        <div>
          <label className="block text-sm font-bold text-mmarumoBlue mb-1">QR Tag String (Must match static QR)</label>
          <input
            type="text"
            placeholder="e.g. SUMMER_COOLERBOX"
            className="w-full p-3 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
            value={tagType}
            onChange={(e) => setTagType(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Quantity */}
          <div>
            <label className="block text-sm font-bold text-mmarumoBlue mb-1">Quantity Given</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 50"
              className="w-full p-3 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
              value={initialStock}
              onChange={(e) => setInitialStock(e.target.value)}
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-bold text-mmarumoBlue mb-1">Price (Pula)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 150.00"
              className="w-full p-3 border border-gray-600 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>

        {/* Submit Button */}
        <button 
          type="submit"
          disabled={isSubmitting}
          className={`w-full mt-4 px-4 py-3 rounded text-white font-bold transition-colors ${
            isSubmitting ? 'bg-gray-600' : 'bg-mmarumoBlue hover:bg-blue-800'
          }`}
        >
          {isSubmitting ? 'Saving Allocation...' : 'Issue to Vendor'}
        </button>
      </form>

      {/* Status Notifications */}
      {status.message && (
        <div className={`mt-6 p-4 rounded text-center font-bold text-white ${
          status.type === 'success' ? 'bg-green-700' : 'bg-mmarumoRed'
        }`}>
          {status.message}
        </div>
      )}
    </div>
  )
}
