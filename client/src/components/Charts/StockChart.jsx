import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const StockChart = ({ data, title, color = "#3b82f6", predictionData = null }) => {
  const combinedData = predictionData
    ? [...data, ...predictionData.map(p => ({ ...p, isPrediction: true }))]
    : data

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
          <p className="text-white text-sm">{data.date}</p>
          <p className={`text-sm font-semibold ${data.isPrediction ? 'text-primary-400' : 'text-white'}`}>
            ${typeof data.value === 'number' ? data.value.toFixed(2) : data.value}
            {data.isPrediction && ' (Predicted)'}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-white">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={combinedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              fontSize={12}
            />
            <YAxis
              stroke="#9ca3af"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={payload.isPrediction ? '#3b82f6' : color}
                    stroke={payload.isPrediction ? '#3b82f6' : color}
                    strokeWidth={2}
                  />
                )
              }}
              activeDot={{ r: 6 }}
              connectNulls
            />
            {predictionData && predictionData.length > 0 && (
              <ReferenceLine
                x={data[data.length - 1]?.date}
                stroke="#6b7280"
                strokeDasharray="5 5"
                label={{ value: 'Prediction Start', position: 'top', fill: '#9ca3af' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {predictionData && predictionData.length > 0 && (
        <div className="mt-2 flex items-center justify-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
            <span className="text-gray-400">Historical</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-primary-500"></div>
            <span className="text-gray-400">Predicted</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default StockChart