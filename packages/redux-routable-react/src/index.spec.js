import { createMemoryHistory } from 'history'
import React from 'react'
import TestRenderer from 'react-test-renderer'
import configureStore from 'redux-mock-store'
import { Route, Router, createMiddleware } from 'redux-routable'
import { Link, RouterProvider } from './index'

const mockRouter = Router([
  Route('home', '/'),
  Route('search', '/search/:category?'),
])

const mocks = ({ router = mockRouter } = {}) => {
  const history = createMemoryHistory()
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()
  const create = children =>
    TestRenderer.create(
      <RouterProvider router={router}>{children}</RouterProvider>,
    ).toJSON()

  return { store, history, window, create }
}

describe('Link', () => {
  test('renders an <a> element by default', () => {
    const { create } = mocks()
    const link = create(<Link route="home" />)

    expect(link.type).toBe('a')
  })

  test('renders with a custom component', () => {
    const { create } = mocks()
    const link = create(<Link component="div" route="home" />)

    expect(link.type).toBe('div')
  })

  test('generates the correct href', () => {
    const { create } = mocks()
    const link = create(
      <Link
        route="search"
        params={{ category: 'widgets', query: 'devices' }}
        hash="#items"
      />,
    )

    expect(link.props.href).toBe('/search/widgets?query=devices#items')
  })
})
