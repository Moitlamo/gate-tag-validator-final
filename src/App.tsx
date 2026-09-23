import { useState, useEffect } from 'react'
import { Scanner } from '@yudiel/react-qr-scanner'
import { supabase } from './supabaseClient'

export default function App() {
  const [events, setEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
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
    async function fetchInventory() {
      if (!selectedEvent) return
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .eq('event_name', selectedEvent)
      if (data) setInventory(data)
    }
    fetchInventory()
  }, [selectedEvent])

  useEffect(() => {
    setBuyerPhone('')
    setScannerActive(false)
  }, [selectedEvent])

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

        if (!error) {
          const displayName = scannedData.split('_').slice(-2).join(' ')
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
      setScanStatus({ message: '❌ ERROR: INVALID TAG FOR THIS EVENT', type: 'error' })
    }

    setTimeout(() => {
      setIsProcessing(false)
      setScanStatus({ message: '', type: '' })
    }, 3000)
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 font-sans text-gray-100">
      <header className="mb-6 border-b-2 border-mmarumoRed pb-4">
        <h1 className="text-2xl font-bold text-mmarumoRed">M.Marumo Technologies</h1>
        <h2 className="text-lg text-gray-300">Gate Tag Validator</h2>
      </header>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Select Event</label>
        <select 
          className="w-full p-3 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:border-mmarumoBlue"
          value={selectedEvent}
          onChange={(e) => setSelectedEvent(e.target.value)}
        >
          <option value="">-- Choose an Event --</option>
          {events.map((evt, idx) => (
            <option key={idx} value={evt.name}>{evt.name}</option>
          ))}
        </select>
      </div>

      {selectedEvent && (
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

          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-300">Live Inventory</h3>
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

          <div className="grid grid-cols-2 gap-4 mb-6">
            {inventory.map((item, idx) => {
              const displayName = item.tag_type.includes('_') 
                ? item.tag_type.split('_').slice(-2).join(' ') 
                : item.tag_type;
              
              return (
                <div key={idx} className="bg-gray-900 p-3 rounded border border-gray-700 text-center">
                  <div className="text-xs text-gray-400 uppercase">{displayName}</div>
                  <div className="text-2xl font-bold text-mmarumoBlue">{item.stock_count}</div>
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
