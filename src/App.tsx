import { useState, useEffect } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { supabase } from './supabaseClient'

export default function App() {
  const [events, setEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  
  const [vendors, setVendors] = useState<string[]>([])
  const [selectedVendor, setSelectedVendor] = useState('')
  
  // Security States
  const [pinInput, setPinInput] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginError, setLoginError] = useState('')
  
  const [inventory, setInventory] = useState<any[]>([])
  const [scannerActive, setScannerActive] = useState(false)
  const [scanStatus, setScanStatus] = useState({ message: '', type: '' }) 
  const [isProcessing, setIsProcessing] = useState(false)
  
  const [buyerPhone, setBuyerPhone] = useState('')

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase.from('events').select('name')
      if (data) setEvents(data)
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    async function fetchVendors() {
      if (!selectedEvent) {
        setVendors([])
        return
      }
      const { data } = await supabase
        .from('inventory')
        .select('vendor_name')
        .eq('event_name', selectedEvent)
      
      if (data) {
        const uniqueVendors = Array.from(new Set(data.map(item => item.vendor_name)))
        setVendors(uniqueVendors as string[])
      }
    }
    fetchVendors()
    
    // Reset session states when event changes
    setSelectedVendor('')
    setIsAuthenticated(false)
    setPinInput('')
    setInventory([])
    setScannerActive(false)
  }, [selectedEvent])

  useEffect(() => {
    async function fetchInventory() {
      if (!selectedEvent || !selectedVendor || !isAuthenticated) return
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('event_name', selectedEvent)
        .eq('vendor_name', selectedVendor)
        
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [selectedEvent, selectedVendor, isAuthenticated])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setIsProcessing(true)

    const { data, error } = await supabase
      .from('vendor_auth')
      .select('pin_code')
      .eq('vendor_name', selectedVendor)
      .single()

    setIsProcessing(false)

    if (error || !data) {
      setLoginError('❌ Account not registered in auth system.')
      return
    }

    if (data.pin_code === pinInput) {
      setIsAuthenticated(true)
    } else {
      setLoginError('❌ Incorrect PIN.')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    setPinInput('')
    setSelectedVendor('')
    setScannerActive(false)
    setInventory([])
  }

  const handleScan = async (scannedData: string) => {
    if (!scannedData || isProcessing) return
    setIsProcessing(true)
    
    const targetTag = inventory.find(item => item.tag_type === scannedData)
    
    if (targetTag) {
      if (targetTag.stock_count > 0) {
        const newStock = targetTag.stock_count - 1
        
        const { error } = await supabase
          .from('inventory')
          .update({ stock_count: newStock })
          .eq('tag_type', scannedData)
          .eq('event_name', selectedEvent)
          .eq('vendor_name', selectedVendor)

        if (!error) {
          const displayName = scannedData.includes('_') 
            ? scannedData.split('_').slice(-2).join(' ') 
            : scannedData;
          const buyerText = buyerPhone ? `to ${buyerPhone}` : 'issued'
          
          setScanStatus({ 
            message: `✅ ISSUED: 1 ${displayName} ${buyerText} (Remaining: ${newStock})`, 
            type: 'success' 
          })
          
          setInventory(inventory.map(item => 
            item.tag_type === scannedData ? { ...item, stock_count: newStock } : item
          ))
          
          setBuyerPhone('')
          setScannerActive(false)
          
        } else {
          setScanStatus({ message: '❌ DATABASE ERROR', type: 'error' })
        }
      } else {
        setScanStatus({ message: '❌ ERROR: OUT OF STOCK', type: 'error' })
      }
    } else {
      setScanStatus({ message: '❌ ERROR: INVALID TAG FOR THIS VENDOR', type: 'error' })
    }

    setTimeout(() => {
      setIsProcessing(false)
      setScanStatus({ message: '', type: '' })
    }, 3000)
  }

  const totalExpectedCash = inventory.reduce((total, item) => {
    const sold = (item.initial_stock || 0) - (item.stock_count || 0)
    return total + (sold * (item.price || 0))
  }, 0)

  return (
    <div className="min-h-screen bg-gray-900 p-4 font-sans text-gray-100">
      <header className="mb-6 border-b-2 border-mmarumoRed pb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-mmarumoRed">M.Marumo Technologies</h1>
          <h2 className="text-lg text-gray-300">Gate Tag Validator</h2>
        </div>
        {isAuthenticated && (
          <button 
            onClick={handleLogout}
            className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-white"
          >
            Logout
          </button>
        )}
      </header>

      {/* LOGIN GATE */}
      {!isAuthenticated ? (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md border border-gray-700 max-w-md mx-auto mt-10">
          <h3 className="text-xl font-bold text-mmarumoBlue mb-4">Vendor Secure Login</h3>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Event</label>
              <select 
                className="w-full p-3 border border-gray-700 bg-gray-900 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
              >
                <option value="">-- Choose Event --</option>
                {events.map((evt, idx) => (
                  <option key={idx} value={evt.name}>{evt.name}</option>
                ))}
              </select>
            </div>

            {selectedEvent && vendors.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Vendor ID / Name</label>
                <select 
                  className="w-full p-3 border border-gray-700 bg-gray-900 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                >
                  <option value="">-- Select Identity --</option>
                  {vendors.map((vendor, idx) => (
                    <option key={idx} value={vendor}>{vendor}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedVendor && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Access PIN</label>
                <input
                  type="password"
                  placeholder="Enter 4-digit PIN"
                  className="w-full p-3 border border-gray-700 bg-gray-900 text-white rounded-md focus:outline-none focus:border-mmarumoRed text-center tracking-widest text-lg"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                />
              </div>
            )}

            {selectedVendor && (
              <button 
                type="submit"
                disabled={isProcessing}
                className={`w-full py-3 rounded text-white font-bold transition-colors ${
                  isProcessing ? 'bg-gray-600' : 'bg-mmarumoBlue hover:bg-blue-800'
                }`}
              >
                {isProcessing ? 'Verifying...' : 'Access Dashboard'}
              </button>
            )}

            {loginError && (
              <div className="mt-4 p-3 bg-mmarumoRed text-white rounded text-center font-bold">
                {loginError}
              </div>
            )}
          </form>
        </div>
      ) : (
        /* VENDOR DASHBOARD (Only visible after login) */
        <div className="bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700">
          
          <div className="mb-6 border-b border-gray-700 pb-6">
            <label className="block text-sm font-bold text-mmarumoBlue mb-2">Buyer Phone Number (Optional)</label>
            <input
              type="tel"
              placeholder="e.g. 71234567"
              className="w-full p-3 border border-gray-600 bg-gray-900 text-white rounded-md focus:outline-none focus:border-mmarumoRed"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
            />
          </div>

          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-lg font-bold text-gray-300">Active: {selectedVendor}</h3>
              <p className="text-sm font-bold text-green-400">Total Cash: P {totalExpectedCash.toFixed(2)}</p>
            </div>
            <button 
              onClick={() => setScannerActive(!scannerActive)}
              className={`px-4 py-2 rounded text-white font-bold transition-colors ${
                scannerActive 
                  ? 'bg-mmarumoRed hover:bg-red-800' 
                  : 'bg-mmarumoBlue hover:bg-blue-800'
              }`}
            >
              {scannerActive ? 'Turn Off Scanner' : 'Activate Scanner'}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-6">
            {inventory.map((item, idx) => {
              const displayName = item.tag_type.includes('_') 
                ? item.tag_type.split('_').slice(-2).join(' ') 
                : item.tag_type;
              
              const ticketsSold = (item.initial_stock || 0) - (item.stock_count || 0)
              const cashExpected = ticketsSold * (item.price || 0)
              
              return (
                <div key={idx} className="bg-gray-900 p-4 rounded border border-gray-700 flex justify-between items-center">
                  <div>
                    <div className="text-sm text-gray-400 uppercase font-bold">{displayName}</div>
                    <div className="text-xs text-gray-500">Price: P {item.price} | Sold: {ticketsSold}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-mmarumoBlue">{item.stock_count} <span className="text-sm font-normal text-gray-400">left</span></div>
                    <div className="text-sm font-bold text-green-400">P {cashExpected.toFixed(2)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {scannerActive && (
            <div className="mt-4 border-4 border-dashed border-gray-600 rounded-lg overflow-hidden bg-black">
              <Scanner
                onScan={(result: any) => {
                  if (result && result.length > 0) {
                    handleScan(result[0].rawValue)
                  }
                }}
                onError={(err: any) => console.log(err?.message)}
              />
            </div>
          )}

          {scanStatus.message && (
            <div className={`mt-6 p-4 rounded text-center font-bold text-white text-lg ${
              scanStatus.type === 'success' ? 'bg-mmarumoBlue' : 'bg-mmarumoRed'
            }`}>
              {scanStatus.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
