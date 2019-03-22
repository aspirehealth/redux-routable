import { createPath } from 'history'
import PropTypes from 'prop-types'
import React, { createContext, useCallback, useContext } from 'react'
import { connect } from 'react-redux'
import { Router, open, push, replace, routeToLocation } from 'redux-routable'

const RouterContext = createContext()

// RouterProvider
export const RouterProvider = ({ router, children }) => (
  <RouterContext.Provider value={router}>{children}</RouterContext.Provider>
)

RouterProvider.propTypes = {
  router: PropTypes.instanceOf(Router).isRequired,
  children: PropTypes.node,
}

// Link
const linkActionCreators = { push, replace, open }

export const Link = connect()(
  ({
    component: Component,
    action,
    route,
    params,
    hash,
    dispatch,
    ...props
  }) => {
    const router = useContext(RouterContext)
    const location = routeToLocation(router, route, params, hash)
    const href = createPath(location)

    const onClick = useCallback(() => {
      const actionCreator = linkActionCreators[action]
      const linkAction = actionCreator(route, params, hash)

      dispatch(linkAction)
    }, [action, href])

    return <Component {...props} href={href} onClick={onClick} />
  },
)

Link.propTypes = {
  component: PropTypes.oneOfType([PropTypes.string, PropTypes.func]),
  action: PropTypes.oneOf(['push', 'replace', 'open']),
  route: PropTypes.string.isRequired,
  params: PropTypes.objectOf(PropTypes.string),
  hash: PropTypes.string,
}

Link.defaultProps = {
  component: 'a',
  action: 'push',
  params: {},
  hash: '',
}
